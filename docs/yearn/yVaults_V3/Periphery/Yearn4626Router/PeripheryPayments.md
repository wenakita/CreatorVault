PeripheryPayments
Git Source

Immutable state used by periphery contracts Largely Forked from https://github.com/Uniswap/v3-periphery/blob/main/contracts/base/PeripheryPayments.sol Changes: no interface no inheritdoc add immutable WETH9 in constructor instead of PeripheryImmutableState receive from any address Solmate interfaces and transfer lib casting add approve, wrapWETH9 and pullToken

State Variables
WETH9
IWETH9 public immutable WETH9;

Functions
constructor
constructor(IWETH9 _WETH9);

receive
receive() external payable;

approve
function approve(ERC20 token, address to, uint256 amount) public payable;

unwrapWETH9
function unwrapWETH9(uint256 amountMinimum, address recipient) public payable;

wrapWETH9
function wrapWETH9() public payable;

pullToken
function pullToken(ERC20 token, uint256 amount, address recipient) public payable;

sweepToken
function sweepToken(ERC20 token, uint256 amountMinimum, address recipient) public payable;

refundETH
function refundETH() external payable;