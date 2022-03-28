// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.11;

// libraries
import "./external/@openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "./external/@openzeppelin/utils/SafeCast.sol";

// extends
import "./interfaces/IFeeHandler.sol";
import "./shared/SpoolOwnable.sol";
import "./shared/Constants.sol";

// other imports
import "./interfaces/IController.sol";

struct PlatformCollectedFees {
    uint128 ecosystem;
    uint128 treasury;
}

/**
 * @notice Implementation of the {IFeeHandler} interface.
 *
 * @dev
 * Handles fees generated by vaults.
 * Fees are only collected when a user withdraws and calculated
 * from the generated profit (performance fees).
 *
 * There are 4 type of fees:
 * - Ecosystem fee: Circle back in Spool ecosystem and is distributed to Spool system participants
 * - Treasury fee: Collected by the Spool DAO to support the development of the Spool
 * - Risk provider fee: Collected the risk provider the vault is using to allocate it's funds
 * - Vault owner fee: Collected by the vault owner (initially the vault creator, later can be transferred to another address)
 */
contract FeeHandler is IFeeHandler, SpoolOwnable, BaseConstants {
    using SafeERC20 for IERC20;

    /* ========== CONSTANTS ========== */

    /// @notice Maximum Ecosystem Fee (20%) 
    uint256 public constant MAX_ECOSYSTEM_FEE = 20_00;
    /// @notice Max Treasury Fee (10%)
    uint256 public constant MAX_TREASURY_FEE = 10_00; 
    /// @notice Max Risk Provider Fee (5%)
    uint256 public constant MAX_RISK_PROVIDER_FEE = 5_00;

    /* ========== STATE VARIABLES ========== */

    /// @notice controller contract
    IController public immutable controller;
    /// @notice risk provider registry contract
    address public immutable riskProviderRegistry;

    /// @notice Current Ecosystem Fee
    uint16 public ecosystemFee;
    /// @notice Current Treasury Fee
    uint16 public treasuryFee;
    /// @notice Current Ecosystem Fee to the collector
    address public ecosystemFeeCollector;
    /// @notice Current Treasury Fee to the collector
    address public treasuryFeeCollector;


    /// @notice ecosystem and treasury collected fees
    mapping(IERC20 => PlatformCollectedFees) public platformCollectedFees;

    /// @notice Risk provider fee size
    mapping(address => uint16) public riskProviderFees;

    /// @notice risk provider and vault owner collected fees
    mapping(address => mapping(IERC20 => uint256)) public collectedFees;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @notice Sets the contract initial values
     *
     * @dev It performs certain pre-conditional validations to ensure the contract
     * has been initialized properly, such as that addresses are valid.
     *
     * @param _spoolOwner the spool owner contract that owns this contract
     * @param _controller responsible for creating new vaults
     * @param _riskProviderRegistry responsible for handling risk providers
     * @param _ecosystemFee fee to ecosystem
     * @param _treasuryFee fee to treasury
     * @param _ecosystemFeeCollector address of ecosystem fee collector
     * @param _treasuryFeeCollector address of treasury fee collector
     */
    constructor(
        ISpoolOwner _spoolOwner,
        IController _controller,
        address _riskProviderRegistry,
        uint16 _ecosystemFee,
        uint16 _treasuryFee,
        address _ecosystemFeeCollector,
        address _treasuryFeeCollector
    )
        SpoolOwnable(_spoolOwner)
    {
        require(address(_controller) != address(0), "FeeHandler::constructor: Controller address cannot be 0");
        require(_riskProviderRegistry != address(0), "FeeHandler::constructor: Risk Provider Registry address cannot be 0");
        require(_ecosystemFeeCollector != address(0), "FeeHandler::constructor: Ecosystem Fee Collector cannot be 0");
        require(_treasuryFeeCollector != address(0), "FeeHandler::constructor: Treasury Fee Collector address cannot be 0");

        controller = _controller;
        riskProviderRegistry = _riskProviderRegistry;

        _setEcosystemFee(_ecosystemFee);
        _setTreasuryFee(_treasuryFee);

        _setEcosystemCollector(_ecosystemFeeCollector);
        _setTreasuryCollector(_treasuryFeeCollector);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @notice Collect vault owner and risk provider fees
     *
     * @dev
     * transfers any fees collected for the sender to them.
     * fees are only collected for the vault owner and risk providers. if it's called by
     * anyone else it will have no effect.
     *
     * NOTE To save on storage fees, we use the value stored at collectedFees as a kind of boolean.
     * if there are fees to be collected (value > 1), we send the fees to the user, and then set the word
     * as 1. the value must be greater than this to send fees again. Therefore only the first SSTORE is 20k
     * and subsequent writes are 5k.
     *
     * @param tokens token addresses for which fees have been collected in
     */
    function collectFees(IERC20[] calldata tokens) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = collectedFees[msg.sender][tokens[i]];
            if (amount > 1) {
                amount--;
                collectedFees[msg.sender][tokens[i]] = 1;
                tokens[i].safeTransfer(msg.sender, amount);

                emit FeeCollected(msg.sender, tokens[i], amount);
            }
        }
    }

    /**
     * @notice Collect ecosystem fees
     *
     * transfers any fees collected for the ecosystem fee collecter to them.
     * callable by anyone, but only transfers to ecosystem fee collector address.
     * see NOTE in {collectFees} for more details on internal logic.
     *
     * @param tokens token addresses for which fees have been collected in
     */
    function collectEcosystemFees(IERC20[] calldata tokens) external {
        require(
            ecosystemFeeCollector == msg.sender,
            "FeeHandler::collectEcosystemFees: Caller not ecosystem fee collector."
        );

        for (uint256 i = 0; i < tokens.length; i++) {
            uint128 amount = platformCollectedFees[tokens[i]].ecosystem;
            if (amount > 1) {
                amount--;
                platformCollectedFees[tokens[i]].ecosystem = 1;
                tokens[i].safeTransfer(msg.sender, amount);

                emit EcosystemFeeCollected(tokens[i], amount);
            }
        }
    }

    /**
     * @notice Collect treasury fees
     *
     * transfers any fees collected for the treasury fee collecter to them.
     * see NOTE in {collectFees} for more details on internal logic.
     *
     * @param tokens token addresses for which fees have been collected in
     */    
    function collectTreasuryFees(IERC20[] calldata tokens) external {
        require(
            treasuryFeeCollector == msg.sender,
            "FeeHandler::collectTreasuryFees: Caller not treasury fee collector."
        );

        for (uint256 i = 0; i < tokens.length; i++) {
            uint128 amount = platformCollectedFees[tokens[i]].treasury;
            if (amount > 1) {
                amount--;
                platformCollectedFees[tokens[i]].treasury = 1;
                tokens[i].safeTransfer(msg.sender, amount);

                emit TreasuryFeeCollected(tokens[i], amount);
            }
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @notice Pay vault fees to ecosystem, treasury, risk provider and vault owner.
     * @dev
     * Returns total fee size, that is later transfered by vault to this contract.
     *
     * Requirements:
     * - caller must be a vault
     *
     * @param underlying token address for which fees are to be paid
     * @param profit User realized profit
     * @param riskProvider address of the risk provider for which fees are to be paid
     * @param vaultOwner address of the owner of the calling vault, recipient of the vault fees
     * @param vaultFee fee to owner in the calling vault
     *
     * @return feesPaid total calculated fees paid from the user profit
     */
    function payFees(
        IERC20 underlying,
        uint256 profit,
        address riskProvider,
        address vaultOwner,
        uint16 vaultFee
    ) 
        external
        override
        onlyVault
        returns (uint256 feesPaid)
    {
        // ecosystem
        uint128 ecosystemCollected = _calculateFee(profit, ecosystemFee);
        if (ecosystemCollected > 0) {
            platformCollectedFees[underlying].ecosystem += ecosystemCollected;
            feesPaid += ecosystemCollected;
        }

        // treasury
        uint128 treasuryCollected = _calculateFee(profit, treasuryFee);
        if (treasuryCollected > 0) {
            platformCollectedFees[underlying].treasury += treasuryCollected;
            feesPaid += treasuryCollected;
        }

        // risk provider
        uint16 riskProviderFee = riskProviderFees[riskProvider];
        uint128 riskProviderColected = _calculateFee(profit, riskProviderFee);
        if (riskProviderColected > 0) {
            collectedFees[riskProvider][underlying] += riskProviderColected;
            feesPaid += riskProviderColected;
        }

        // vault owner
        uint128 vaultFeeCollected = _calculateFee(profit, vaultFee);
        if (vaultFeeCollected > 0) {
            collectedFees[vaultOwner][underlying] += riskProviderColected;
            feesPaid += vaultFeeCollected;
        }

        emit FeesPaid(msg.sender, profit, ecosystemCollected, treasuryCollected, riskProviderColected, vaultFeeCollected);
    }

    /**
     * @notice Set risk provider fee size
     *
     * @dev
     * Requirements:
     *
     * - caller must be the risk provider registry
     *
     * @param riskProvider address to risk provider to set fee for
     * @param fee fee to set for the risk provider
     */
    function setRiskProviderFee(address riskProvider, uint16 fee) external override onlyRiskProviderRegistry {
        _setRiskProviderFee(riskProvider, fee);
    }

    /**
     * @notice Set ecosystem fee size
     *
     * @dev
     * Requirements:
     *
     * - caller must be the spool owner
     *
     * @param fee ecosystem fee to set
     */
    function setEcosystemFee(uint16 fee) external onlyOwner {
        _setEcosystemFee(fee);
    }

    /**
     * @notice Set treasury fee size
     *
     * @dev
     * Requirements:
     *
     * - caller must be the spool owner
     *
     * @param fee treasury fee to set
     */
    function setTreasuryFee(uint16 fee) external onlyOwner {
        _setTreasuryFee(fee);
    }
    
    /**
     * @notice Set ecosystem fee collector address
     *
     * @dev
     * Requirements:
     * - caller must be the spool owner
     *
     * @param collector ecosystem fee collector address to set
     */
    function setEcosystemCollector(address collector) external onlyOwner {
        _setEcosystemCollector(collector);
    }

    /**
     * @notice Set treasiry fee collector address
     *
     * @dev
     * Requirements:
     * - caller must be the spool owner
     *
     * @param collector treasiry fee collector address to set
     */
    function setTreasuryCollector(address collector) external onlyOwner {
        _setTreasuryCollector(collector);
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    /**
     * @notice calculate fee from profit and size of fee
     *
     * @param profit user profit amount
     * @param feeSize fee size in basis points
     */
    function _calculateFee(uint256 profit, uint16 feeSize) private pure returns(uint128) {
        return SafeCast.toUint128((profit * feeSize) / FULL_PERCENT);
    }

    /**
     * @notice Set risk provider fee size
     *
     * @dev
     * Requirements:
     *
     * - fee must be less than or equal to the max risk provider fee
     *
     * @param riskProvider address to risk provider to set fee for
     * @param fee fee to set for the risk provider
     */
    function _setRiskProviderFee(address riskProvider, uint16 fee) private {
        require(fee <= MAX_RISK_PROVIDER_FEE, "FeeHandler::_setRiskProviderFee: Risk Provider fee too big");
        riskProviderFees[riskProvider] = fee;
        emit RiskProviderFeeUpdated(riskProvider, fee);
    }

    /**
     * @notice Set ecosystem fee size
     *
     * @dev
     * Requirements:
     *
     * - fee must be less than or equal to the max ecosystem fee
     *
     * @param fee ecosystem fee to set
     */    
     function _setEcosystemFee(uint16 fee) private {
        require(fee <= MAX_ECOSYSTEM_FEE, "FeeHandler::_setEcosystemFee: Ecosystem fee too big");
        ecosystemFee = fee;
        emit EcosystemFeeUpdated(fee);
    }

    /**
     * @notice Set treasury fee size
     *
     * @dev
     * Requirements:
     *
     * - fee must be less than or equal to the max treasury fee
     *
     * @param fee treasury fee to set
     */
    function _setTreasuryFee(uint16 fee) private {
        require(fee <= MAX_TREASURY_FEE, "FeeHandler::_setTreasuryFee: Treasury fee too big");
        treasuryFee = fee;
        emit TreasuryFeeUpdated(fee);
    }

    /**
     * @notice Set ecosystem fee collector address
     *
     * @dev
     * Requirements:
     * - collector cannot be 0
     *
     * @param collector ecosystem fee collector address to set
     */
    function _setEcosystemCollector(address collector) private {
        require(collector != address(0), "FeeHandler::_setEcosystemCollector: Ecosystem Fee Collector address cannot be 0");
        ecosystemFeeCollector = collector;
        emit EcosystemCollectorUpdated(collector);
    }

    /**
     * @notice Set treasiry fee collector address
     *
     * @dev
     * Requirements:
     - collector cannot be 0
     *
     * @param collector treasiry fee collector address to set
     */    
    function _setTreasuryCollector(address collector) private {
        require(collector != address(0), "FeeHandler::_setTreasuryCollector: Treasury Fee Collector address cannot be 0");
        treasuryFeeCollector = collector;
        emit TreasuryCollectorUpdated(collector);
    }

    /**
     * @notice Ensures that the caller is a valid vault
     *
     * @dev
     * callable only from the onlyVault modifier
     */
    function _onlyVault() private view {
        require(
            controller.validVault(msg.sender),
            "FeeHandler::_onlyVault: Can only be invoked by the Vault"
        );
    }

    /**
     * @notice Ensures that the caller is a risk provider registry
     *
     * @dev
     * Requirements:
     * - caller is the risk provider registry
     */
    function _onlyRiskProviderRegistry() private view {
        require(
            riskProviderRegistry == msg.sender,
            "FeeHandler::_onlyRiskProviderRegistry: Can only be invoked by the Risk Provider Registry"
        );
    }

    /* ========== MODIFIERS ========== */

    /**
     * @notice onlyVault modifier
     *
     * @dev 
     * Throws if called by a non-valid vault
     */
    modifier onlyVault() {
        _onlyVault();
        _;
    }

    /**
     * @notice onlyRiskProviderRegistry modifier
     *
     * @dev 
     * Throws if called by any address other than the risk provider registry
     */
    modifier onlyRiskProviderRegistry() {
        _onlyRiskProviderRegistry();
        _;
    }
}
