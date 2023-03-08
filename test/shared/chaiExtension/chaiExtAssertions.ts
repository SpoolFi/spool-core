import { Assertion, expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";
import { formatUnits } from "ethers/lib/utils";

export enum BasisPoints {
    Basis_1000 = 10_00, // 10%
    Basis_500 = 5_00, // 5%
    Basis_200 = 2_00, // 2%
    Basis_100 = 1_00, // 1%
    Basis_50 = 0_50, // 0.5%
    Basis_10 = 0_10, // 0.1%
    Basis_5 = 0_05, // 0.05%
    Basis_3 = 0_03, // 0.03%
    Basis_1 = 0_01, // 0.01%
    Basis_01 = 0.1, // 0.001%
}

const FULL_PERCENT_BASIS = 100_00;

// adds big number close to comparison, wllowed precision up to a desired precision in basis points
Assertion.addMethod("beCloseTo", function (shouldBeish: BigNumberish, precision: number, message?: string) {
    if (precision < 0 || precision > FULL_PERCENT_BASIS) {
        throw new Error(`Bad precision parameter value ${precision}`);
    }

    const result = BigNumber.from(this._obj);
    const shouldBe = BigNumber.from(shouldBeish);

    const precisionDivider = Math.round(FULL_PERCENT_BASIS / precision);

    const resultErrorMargin = shouldBe.div(precisionDivider).abs();

    const resultLow = shouldBe.sub(resultErrorMargin);
    const resultHigh = shouldBe.add(resultErrorMargin);

    let errorMessage = `Expected ${result.toString()} to be within ${resultLow.toString()} and ${resultHigh.toString()}. ${getRelativeDiffErrorMessage(result, shouldBe)}.`;
    if (message) {
        errorMessage = `${message}. ${errorMessage}`;
    }

    this.assert(
        result.gte(resultLow) && result.lte(resultHigh),
        errorMessage,
        "Expected not to be close to",
        shouldBe.toString(),
        result.toString()
    );
});

Assertion.addMethod("equalOrLowerCloseTo", function (shouldBeish: BigNumberish, precision: number, message?: string) {
    if (precision < 0 || precision > FULL_PERCENT_BASIS) {
        throw new Error(`Bad precision parameter value ${precision}`);
    }

    const result = BigNumber.from(this._obj);
    const shouldBe = BigNumber.from(shouldBeish);

    const precisionDivider = Math.round(FULL_PERCENT_BASIS / precision);

    const resultErrorMargin = shouldBe.div(precisionDivider).abs();

    const resultLow = shouldBe.sub(resultErrorMargin);

    let errorMessage = `Expected ${result.toString()} to be equal or lower than ${shouldBe.toString()}, but more or equal than ${resultLow.toString()}. ${getRelativeDiffErrorMessage(result, shouldBe)}.`;
    if (message) {
        errorMessage = `${message}. ${errorMessage}`;
    }

    this.assert(
        result.lte(shouldBe) && result.gte(resultLow),
        errorMessage,
        "Expected not equal or lower close to",
        shouldBe.toString(),
        result.toString()
    );
});

Assertion.addMethod("greaterWithTolerance", function (shouldBeish: BigNumberish, precision: number, message?: string) {
    if (precision < 0 || precision > FULL_PERCENT_BASIS) {
        throw new Error(`Bad precision parameter value ${precision}`);
    }

    const result = BigNumber.from(this._obj);
    const shouldBe = BigNumber.from(shouldBeish);

    const precisionDivider = Math.round(FULL_PERCENT_BASIS / precision);

    const resultErrorMargin = shouldBe.div(precisionDivider).abs();

    const resultLow = shouldBe.sub(resultErrorMargin);

    let errorMessage = `${message}. Expected ${result.toString()} to be greater than ${resultLow.toString()}. ${getRelativeDiffErrorMessage(result, shouldBe)}.`;
    if (message) {
        errorMessage = `${message}. ${errorMessage}`;
    }

    expect(result, errorMessage).to.be.gte(resultLow, errorMessage);

    this.assert(
        result.gte(resultLow),
        errorMessage,
        "Expected not to be greater with tolerance",
        shouldBe.toString(),
        result.toString()
    );
});

function getRelativeDiffErrorMessage(result: BigNumber, shouldBe: BigNumber) {
    let errorMessageRelative = "";
    const absoluteDiff = shouldBe.sub(result).abs();
    if (!shouldBe.isZero()) {
        const percentageDifference = formatUnits(absoluteDiff.mul(1_000_000_000).div(shouldBe), 7);
        errorMessageRelative = `Relative diff is ${percentageDifference.toString()}%`;
    } else {
        errorMessageRelative = `Absolute diff is ${absoluteDiff.toString()}`;
    }

    return errorMessageRelative;
}
