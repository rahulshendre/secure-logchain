const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Ganache connection URL
const ganacheUrl = 'http://127.0.0.1:7545';
const web3 = new Web3(ganacheUrl);

// Compile the Solidity contract
function compileContract() {
  // Read the contract source code
  const contractPath = path.join(__dirname, '..', 'contracts', 'SecureLog.sol');
  const sourceCode = fs.readFileSync(contractPath, 'utf8');

  // Compile the contract
  const input = {
    language: 'Solidity',
    sources: {
      'SecureLog.sol': {
        content: sourceCode,
      },
    },
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode'],
        },
      },
      evmVersion: 'london',
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  // Check for compilation errors
  if (output.errors) {
    const errors = output.errors.filter(e => e.severity === 'error');
    if (errors.length > 0) {
      throw new Error('Compilation errors: ' + JSON.stringify(errors, null, 2));
    }
  }

  // Get the compiled contract
  const contract = output.contracts['SecureLog.sol']['SecureLog'];
  return {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object,
  };
}

// Deploy the contract to Ganache
async function deployContract() {
  try {
    // Check connection to Ganache
    const isConnected = await web3.eth.net.isListening();
    if (!isConnected) {
      throw new Error('Failed to connect to Ganache');
    }

    console.log('[OK] Connected to Ganache');

    // Compile the contract
    console.log('Compiling contract...');
    const { abi, bytecode } = compileContract();
    
    // Validate bytecode
    if (!bytecode || bytecode.length === 0) {
      throw new Error('Compiled bytecode is empty');
    }
    
    console.log('[OK] Contract compiled successfully');
    console.log('Bytecode length:', bytecode.length, 'characters\n');

    // Get the first account from Ganache (deployer)
    const accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts available in Ganache');
    }

    const deployer = accounts[0];
    console.log('Deploying from account:', deployer);

    // Get deployer balance
    const balance = await web3.eth.getBalance(deployer);
    console.log('Account balance:', web3.utils.fromWei(balance, 'ether'), 'ETH\n');

    // Deploy the contract
    console.log('Deploying contract...');
    // Ensure bytecode has 0x prefix
    const bytecodeWithPrefix = bytecode.startsWith('0x') ? bytecode : '0x' + bytecode;
    
    // Deploy using web3.js v4 API
    const contract = new web3.eth.Contract(abi);
    
    // Estimate gas first
    const gasEstimate = await contract.deploy({
      data: bytecodeWithPrefix,
    }).estimateGas({
      from: deployer,
    });
    
    console.log('Estimated gas:', gasEstimate.toString());
    
    // Convert BigInt to string and add buffer
    const gasWithBuffer = (BigInt(gasEstimate) + BigInt(100000)).toString();
    
    const deployedContract = await contract.deploy({
      data: bytecodeWithPrefix,
    }).send({
      from: deployer,
      gas: gasWithBuffer,
    });

    // Save contract ABI and address to JSON file for backend use
    const contractInfo = {
      abi: abi,
      address: deployedContract.options.address,
      network: ganacheUrl,
    };
    fs.writeFileSync(
      path.join(__dirname, '..', 'data', 'contract-info.json'),
      JSON.stringify(contractInfo, null, 2)
    );

    // Print the contract address
    console.log('\n[OK] Contract deployed successfully!');
    console.log('Contract Address:', deployedContract.options.address);
    console.log('Contract info saved to contract-info.json\n');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('[ERROR] Connection Error: Could not connect to Ganache');
      console.error('  Make sure Ganache is running at', ganacheUrl);
    } else {
      console.error('[ERROR] Error:', error.message);
    }
    process.exit(1);
  }
}

// Run deployment
deployContract();

