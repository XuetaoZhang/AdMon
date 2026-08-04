// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAdMonPendingPayout {
    function withdrawPendingPayout(address payable recipient) external;
}

contract RejectingReceiver {
    function withdrawTo(address adMon, address payable recipient) external {
        IAdMonPendingPayout(adMon).withdrawPendingPayout(recipient);
    }

    receive() external payable {
        revert("native MON rejected");
    }
}
