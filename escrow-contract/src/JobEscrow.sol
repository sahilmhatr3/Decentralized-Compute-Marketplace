// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract JobEscrow {
    event JobFunded(bytes32 indexed jobId, address indexed requester, uint256 amount);
    event JobReleased(bytes32 indexed jobId, address indexed provider, uint256 amount);
    event JobCanceled(bytes32 indexed jobId, address indexed requester, uint256 amount);

    mapping(bytes32 => uint256) private _escrow;
    mapping(bytes32 => address) private _requesterOf;
    mapping(bytes32 => bool) private _released;
    mapping(bytes32 => bool) private _canceled;

    function deposit(bytes32 jobId) external payable {
        require(msg.value > 0, "no value");
        address prev = _requesterOf[jobId];
        require(prev == address(0) || prev == msg.sender, "different requester");
        require(_escrow[jobId] == 0, "already funded");
        _requesterOf[jobId] = msg.sender;
        _escrow[jobId] = msg.value;
        emit JobFunded(jobId, msg.sender, msg.value);
    }

    function release(bytes32 jobId, address provider) external {
        require(msg.sender == _requesterOf[jobId], "not requester");
        require(!_released[jobId], "released");
        require(!_canceled[jobId], "canceled");
        uint256 amt = _escrow[jobId];
        require(amt > 0, "empty");
        _released[jobId] = true;
        _escrow[jobId] = 0;
        (bool ok, ) = provider.call{value: amt}("");
        require(ok, "xfer fail");
        emit JobReleased(jobId, provider, amt);
    }

    function cancel(bytes32 jobId) external {
        require(msg.sender == _requesterOf[jobId], "not requester");
        require(!_released[jobId], "released");
        require(!_canceled[jobId], "canceled");
        uint256 amt = _escrow[jobId];
        require(amt > 0, "empty");
        _canceled[jobId] = true;
        _escrow[jobId] = 0;
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok, "refund fail");
        emit JobCanceled(jobId, msg.sender, amt);
    }

    function escrowOf(bytes32 jobId) external view returns (uint256) {
        return _escrow[jobId];
    }

    function requesterOf(bytes32 jobId) external view returns (address) {
        return _requesterOf[jobId];
    }
}


