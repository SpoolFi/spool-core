/// <reference types="chai" />
/// <reference types="sinon-chai" />

// BigNumber extension functions for chai assertions
// Allow error up to a desired precision in basis points
declare module Chai 
{
    export interface Assertion extends LanguageChains, NumericComparison, TypeComparison
    {
        // function beCloseTo(shouldBe: BigNumberish, precision: number)
        beCloseTo(value: any, precision: number): void;
        // function greaterWithTolerance(shouldBe: BigNumberish, precision: number)
        greaterWithTolerance(value: any, precision: number): void;
    }
}

