// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

interface INonFungiblePositionManager {
  function positions(uint256 tokenId) external view returns (
    uint96 nonce,
    address operator,
    address token0,
    address token1,
    uint24 fee,
    int24 tickLower,
    int24 tickUpper,
    uint128 liquidity,
    uint256 feeGrowthInside0LastX128,
    uint256 feeGrowthInside1LastX128,
    uint128 tokensOwed0,
    uint128 tokensOwed1
  );
}

interface ICompoundJob {
  function getWhitelistedTokens() external view returns (address[] memory);
}

contract BatchPositions {
  mapping(address => bool) private _isWhitelistedToken;

  constructor(
    ICompoundJob compoundJob,
    INonFungiblePositionManager nonFungiblePositionManager,
    uint256[] memory tokenIds
  ) {
    address[] memory whitelistedTokens = compoundJob.getWhitelistedTokens();
    
    for (uint256 i = 0; i < whitelistedTokens.length; i++) {
      _isWhitelistedToken[whitelistedTokens[i]] = true;
    }

    
    address token0;
    address token1;

    uint256[] memory returnData = new uint256[](tokenIds.length);
    uint256 counter;

    for (uint256 i = 0; i < tokenIds.length; i++) {
        (,, token0, token1,,,,,,,,) = nonFungiblePositionManager.positions(tokenIds[i]);
        if (_isWhitelistedToken[token0] || _isWhitelistedToken[token1]) {
          returnData[counter] = tokenIds[i];
          counter++;
        }
    }

    // A new array with the correct length is needed for the return data to be correct.
    uint256[] memory _filteredReturnData = new uint256[](counter);

    for (uint256 i = 0; i < counter; i++) {
       _filteredReturnData[i] = returnData[i];
    }

    // encode return data
    bytes memory data = abi.encode(_filteredReturnData);

    // force constructor return via assembly
    assembly {
      // Since we are returning an array of structs
      // we must include the array offset (32b) + length of the array (32b)
      let includedData := 64

      // Include 32 bytes for every element in the returned array
      includedData := add(includedData, mul(counter, 32))

      return(
        add(data, 32), // skip the mem address of the original data (32b) stored by abi.encode
        includedData
      )
    }
  }
}
