// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

// extends
import "../interfaces/spool/ISpoolBase.sol";
import "../shared/BaseStorage.sol";
import "../shared/SpoolOwnable.sol";
import "../shared/Constants.sol";

// libraries
import "../libraries/Hash.sol";

// other imports
import "../interfaces/IController.sol";
import "../shared/SpoolPausable.sol";

/**
 * @notice Implementation of the {ISpoolBase} interface.
 *
 * @dev
 * This implementation acts as the central code execution point of the Spool
 * system and is responsible for maintaining the balance sheet of each vault
 * based on the asynchronous deposit and withdraw system, redeeming vault
 * shares and withdrawals and performing doHardWork.
 */
abstract contract SpoolBase is
    ISpoolBase,
    BaseStorage,
    SpoolOwnable,
    SpoolPausable,
    BaseConstants
{

    /* ========== STATE VARIABLES ========== */

    /// @notice The fast withdraw contract that is used to quickly remove shares
    address internal immutable fastWithdraw;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @notice Sets the contract initial values
     *
     * @dev 
     * Additionally, initializes the SPL reward data for
     * do hard work invocations.
     *
     * It performs certain pre-conditional validations to ensure the contract
     * has been initialized properly, such as valid addresses and reward configuration.
     *
     * @param _spoolOwner the spool owner contract address 
     * @param _controller the controller contract address
     * @param _fastWithdraw the fast withdraw contract address
     */
    constructor(
        ISpoolOwner _spoolOwner,
        IController _controller,
        address _fastWithdraw
    ) 
        SpoolOwnable(_spoolOwner)
        SpoolPausable(_controller)
    {
        require(
            _fastWithdraw != address(0),
            "BaseSpool::constructor: FastWithdraw address cannot be 0"
        );

        fastWithdraw = _fastWithdraw;
        
        globalIndex = 1;
    }

    /* ========== VIEWS ========== */

    /**
     * @notice Returns whether spool is mid reallocation
     */
    function isMidReallocation() public view override returns (bool _isMidReallocation) {
        if (reallocationIndex == globalIndex && !_isBatchComplete()) {
            _isMidReallocation = true;
        }
    }

    /**
     * @notice Returns strategy shares belonging to a vauld
     */
    function getStratVaultShares(address strat, address vault) external view returns(uint128) {
        return strategies[strat].vaults[vault].shares;
    }

    /**
     * @notice Retruns completed index (all strategies in the do hard work have been processed)
     */
    function getCompletedGlobalIndex() public override view returns(uint24) {
        if (_isBatchComplete()) {
            return globalIndex;
        } 
        
        return globalIndex - 1;
    }

    /**
     * @notice Returns next possible index to interact with
     */
    function getActiveGlobalIndex() public override view returns(uint24) {
        return globalIndex + 1;
    }
    
    /**
     * @notice Returns true if all strategies have the same index
     */
    function _isBatchComplete() internal view returns(bool isComplete) {
        if (doHardWorksLeft == 0) {
            isComplete = true;
        }
    }

    function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        // if the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "SILENT";
        assembly {
        // slice the sig hash
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // all that remains is the revert string
    }

    /* ========== DELEGATECALL HELPERS ========== */

    /**
     * @notice this function allows static-calling an arbitrary write function from Spool, off-chain, and returning the result. The general purpose is for the calculation of
     * rewards in an implementation contract, where the reward calculation contains state changes that can't be easily gathered without calling from the Spool contract.
     * The require statement ensure that this comes from a static call off-chain, which can substitute an arbitrary address. 
     * The 'one' address is used. The zero address could be used, but due to the prevalence of zero address checks, the internal calls would likely fail.
     * It has the same level of security as finding any arbitrary address, including address zero.
     */
    function relay(address implementation, bytes memory payload) external returns(bytes memory) {
        require(msg.sender == address(1));
        return _relay(implementation, payload);
    }

    /**
     * @notice Relays the particular action to the strategy via delegatecall.
     */
    function _relay(address strategy, bytes memory payload)
        internal
        returns (bytes memory)
    {
        (bool success, bytes memory data) = strategy.delegatecall(payload);
        if (!success) revert(_getRevertMsg(data));
        return data;
    }

    /* ========== CONFIGURATION ========== */

    function setAllocationProvider(address user, bool _isAllocationProvider) external onlyOwner {
        isAllocationProvider[user] = _isAllocationProvider;
        emit SetAllocationProvider(user, _isAllocationProvider);
    }

    function setDoHardWorker(address user, bool _isDoHardWorker) external onlyOwner {
        isDoHardWorker[user] = _isDoHardWorker;
        emit SetIsDoHardWorker(user, _isDoHardWorker);
    }

    /**
     * @notice Set the flag to force do hard work to be executed in one transaction.
     */
    function setForceOneTxDoHardWork(bool doForce) external onlyOwner {
        forceOneTxDoHardWork = doForce;
    }

    /**
     * @notice Set the flag to log reallocation proportions on change.
     * NOTE: Used for offchain execution to get the new reallocation table.
     */
    function setLogReallocationProportions(bool doLog) external onlyOwner {
        logReallocationTable = doLog;
    }

    /**
     * @notice Set awaiting emergency withdraw flag for the strategy.
     *
     * @dev
     * Only for emergency case where withdrawing the first time doesn't fully work.
     *
     * Requirements:
     *
     * - the caller must be the Spool owner (Spool DAO)
     *
     * @param strat strategy to set
     */
    function setAwaitingEmergencyWithdraw(address strat, bool isAwaiting) external onlyOwner {
        _awaitingEmergencyWithdraw[strat] = isAwaiting;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    function _isVault(address vault) internal view {
        require(
            controller.validVault(vault),
            "NTVLT"
        );
    }

    /**
     * @notice Ensures that strategy wasn't removed
     */
    function _notRemoved(address strat) internal view {
        require(
            !strategies[strat].isRemoved,
            "OKSTRT"
        );
    }

    function _finishDhw(bool isReallocation) internal {
        if (_isBatchComplete()) {
            // reset reallocation variables
            if (isReallocation) {
                reallocationIndex = 0;
                reallocationTableHash = 0;
            }

            emit DoHardWorkCompleted(globalIndex);
        }
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    /**
     * @notice Ensures that the caller is the controller
     */
    function _onlyController() private view {
        require(
            msg.sender == address(controller),
            "OCTRL"
        );
    }

    /**
     * @notice Ensures that the caller is the fast withdraw
     */
    function _onlyFastWithdraw() private view {
        require(
            msg.sender == fastWithdraw,
            "OFWD"
        );
    }

    /**
     * @notice Ensures that there is no pending reallocation
     */
    function _noPendingReallocation() private view {
        require(
            reallocationTableHash == 0,
            "NORLC"
        );
    }

    /**
     * @notice Ensures that strategy is removed
     */
    function _onlyRemoved(address strat) private view {
        require(
            strategies[strat].isRemoved,
            "RMSTR"
        );
    }

    function _verifyStrategies(address[] memory strategies) internal view {
        controller.verifyStrategies(strategies);
    }

    /**
     * @notice Ensures that the caller is allowed to execute do hard work
     */
    function _onlyDoHardWorker() private view {
        require(
            isDoHardWorker[msg.sender],
            "ODHW"
        );
    }

    function _verifyReallocationProportions(uint256[][] memory reallocationProportions) internal view {
        require(reallocationTableHash == Hash.hashReallocationTable(reallocationProportions), "BRLC");
    }

    function _verifyReallocationStrategies(address[] memory strategies) internal view {
        require(Hash.sameStrategies(strategies, reallocationStrategiesHash), "BRLCSTR");
    }

    /* ========== MODIFIERS ========== */

    /**
     * @notice Throws if called by anyone else other than the controller
     */
    modifier onlyDoHardWorker() {
        _onlyDoHardWorker();
        _;
    }

    /**
     * @notice Throws if called by a non-valid vault
     */
    modifier onlyVault() {
        _isVault(msg.sender);
        _;
    }

    /**
     * @notice Throws if called by anyone else other than the controller
     */
    modifier onlyController() {
        _onlyController();
        _;
    }

    /**
     * @notice Throws if the caller is not fast withdraw
     */
    modifier onlyFastWithdraw() {
        _onlyFastWithdraw();
        _;
    }

    modifier verifyStrategies(address[] memory strategies) {
        _verifyStrategies(strategies);
        _;
    }

    modifier verifyReallocationStrategies(address[] memory strategies) {
        _verifyReallocationStrategies(strategies);
        _;
    }

    modifier onlyAllocationProvider() {
        require(
            isAllocationProvider[msg.sender],
            "OALC"
        );
        _;
    }

    modifier noPendingReallocation() {
        _noPendingReallocation();
        _;
    }

    /**
     * @notice Throws strategy is removed
     */
    modifier notRemoved(address strat) {
        _notRemoved(strat);
        _;
    }

    /**
     * @notice Throws strategy isn't removed
     */
    modifier onlyRemoved(address strat) {
        _onlyRemoved(strat);
        _;
    }
}
