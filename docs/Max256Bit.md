# Max256Bit





Handle seeting zero value in a storage word as uint256 max value.

*The purpose of this is to avoid resetting a storage word to the zero value;   the gas cost of re-initializing the value is the same as setting the word originally.  so instead, if word is to be set to zero, we set it to uint256 max.   - anytime a word is loaded from storage: call &quot;get&quot;   - anytime a word is written to storage: call &quot;set&quot;   - common operations on uints are also bundled here. NOTE: This library should ONLY be used when reading or writing *directly* from storage.*



