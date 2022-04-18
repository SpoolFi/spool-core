import { Assertion, expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";

export enum BasisPoints {
    Basis_1000 = 10_00,
    Basis_100 = 1_00,
    Basis_10 = 10,
    Basis_5 = 5,
    Basis_3 = 3,
    Basis_1 = 1,
    Basis_01 = 0.1,
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

    let errorMessage = `Expected ${result.toString()} to be within ${resultLow.toString()} and ${resultHigh.toString()}`;
    if (message) {
        errorMessage = `${message}. ${errorMessage}`;
    }

    this.assert(
        result.gte(resultLow) && result.lte(resultHigh),
        errorMessage,
        "Expected not to be close to",
        result.toString(),
        shouldBe.toString()
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

    let errorMessage = `Expected ${result.toString()} to be equal or lower than ${shouldBe.toString()}, but more or equal than ${resultLow.toString()}.`;
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

    let errorMessage = `${message}. Expected ${result.toString()} to be greater than ${resultLow.toString()}`;
    if (message) {
        errorMessage = `${message}. ${errorMessage}`;
    }

    expect(result, errorMessage).to.be.gte(resultLow, errorMessage);

    this.assert(
        result.gte(resultLow),
        errorMessage,
        "Expected not to be greater than with tolerance",
        shouldBe.toString(),
        result.toString()
    );
});
