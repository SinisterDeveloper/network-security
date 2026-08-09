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

    event HashStored(address indexed sender, uint256 indexed timestamp, string hash, string metadata, uint256 index);

    function storeHash(string calldata hash, string calldata metadata) public {
        records.push(
            Record({
                sender: msg.sender,
                timestamp: block.timestamp,
                hash: hash,
                metadata: metadata
            })
        );
        emit HashStored(msg.sender, block.timestamp, hash, metadata, records.length - 1);
    }

    function getRecordCount() public view returns (uint256) {
        return records.length;
    }

    function getRecord(uint index) public view returns (Record memory) {
        return records[index];
    }
}