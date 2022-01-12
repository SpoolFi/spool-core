import { Assertion, expect } from "chai";
import { BigNumber, BigNumberish } from "ethers";

export enum BasisPoints {
    Basis_1000 = 10_00,
    Basis_100 = 1_00,
    Basis_10 = 10,
    Basis_1 = 1,
}

const FULL_PERCENT_BASIS = 100_00;

// adds big number close to comparison, wllowed precision up to a desired precision in basis points
Assertion.addMethod('beCloseTo', function (shouldBeish: BigNumberish, precision: number) {
    if(!Number.isInteger(precision) || precision < 0 || precision > FULL_PERCENT_BASIS) {
        throw new Error(`Bad precision parameter value ${precision}`);
    }

    const result = BigNumber.from(this._obj);
    const shouldBe = BigNumber.from(shouldBeish);

    const precisionDivider = FULL_PERCENT_BASIS / precision;

    const resultErrorMargin = shouldBe.div(precisionDivider);

    const resultLow = shouldBe.sub(resultErrorMargin);
    const resultHigh = shouldBe.add(resultErrorMargin);

    const errorMessage = `Expected ${result.toString()} to be within ${resultLow.toString()} and ${resultHigh.toString()}`
    expect(result, errorMessage).to.be.gte(resultLow, errorMessage);
    expect(result, errorMessage).to.be.lte(resultHigh, errorMessage);
});

Assertion.addMethod('greaterWithTolerance', function (shouldBeish: BigNumberish, precision: number) {
    if(!Number.isInteger(precision) || precision < 0 || precision > FULL_PERCENT_BASIS) {
        throw new Error(`Bad precision parameter value ${precision}`);
    }

    const result = BigNumber.from(this._obj);
    const shouldBe = BigNumber.from(shouldBeish);
    
    const precisionDivider = FULL_PERCENT_BASIS / precision;
    
    const resultErrorMargin = shouldBe.div(precisionDivider);

    const resultLow = shouldBe.sub(resultErrorMargin);

    const errorMessage = `Expected ${result.toString()} to be greater than ${resultLow.toString()}`
    expect(result, errorMessage).to.be.gte(resultLow, errorMessage);
});