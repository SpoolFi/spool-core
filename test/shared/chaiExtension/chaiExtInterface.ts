/// <reference types="chai" />
/// <reference types="sinon-chai" />

// BigNumber extension functions for chai assertions
// Allow error up to a desired precision in basis points
declare module Chai {
    type BigNumberish = import("ethers").BigNumberish;

    interface Assertion extends LanguageChains, NumericComparison, TypeComparison {
        // function beCloseTo(shouldBe: BigNumberish, precision: number, message?: string)
        beCloseTo(value: BigNumberish, precision: number, message?: string): void;

        // function equalOrLowerCloseTo(shouldBe: BigNumberish, precision: number, message?: string)
        equalOrLowerCloseTo(value: BigNumberish, precision: number, message?: string): void;

        // function greaterWithTolerance(shouldBe: BigNumberish, precision: number, message?: string)
        greaterWithTolerance(value: BigNumberish, precision: number, message?: string): void;
    }
}
