// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

contract PasswordKeychain {

    struct Entry {
        string service;
        string username;
        bytes encryptedPassword;
        uint256 timestamp;
    }

    mapping(address => Entry[]) private keychains;

    function addEntry(
        string memory _service,
        string memory _username,
        bytes memory _encryptedPassword
    ) public {
        keychains[msg.sender].push(
            Entry(_service, _username, _encryptedPassword, block.timestamp)
        );
    }

    function getMyEntries() public view returns (Entry[] memory) {
        return keychains[msg.sender];
    }

    function updateEntry(
        uint256 index,
        bytes memory _newEncryptedPassword
    ) public {
        require(index < keychains[msg.sender].length, "Invalid index");

        keychains[msg.sender][index].encryptedPassword = _newEncryptedPassword;
        keychains[msg.sender][index].timestamp = block.timestamp;
    }

    function deleteEntry(uint256 index) public {
        require(index < keychains[msg.sender].length, "Invalid index");

        uint256 last = keychains[msg.sender].length - 1;
        keychains[msg.sender][index] = keychains[msg.sender][last];
        keychains[msg.sender].pop();
    }
}