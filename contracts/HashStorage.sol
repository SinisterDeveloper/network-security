// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract HashStorage {

    struct Record {
        address sender;
        uint256 timestamp;
        string hash;
        string metadata;
    }

    Record[] public records;

    function storeHash(string calldata hash, string calldata metadata) public {
        records.push(
            Record({
                sender: msg.sender,
                timestamp: block.timestamp,
                hash: hash,
                metadata: metadata
            })
        );
    }

    function getRecord(uint index) public view returns (Record memory) {
        return records[index];
    }
}