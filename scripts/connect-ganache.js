const { Web3 } = require('web3');

// Ganache local blockchain endpoint
const ganacheUrl = 'http://127.0.0.1:7545';

// Create Web3 instance and connect to Ganache
const web3 = new Web3(ganacheUrl);

// Main function to connect and display accounts
async function connectToGanache() {
  try {
    // Check if connection is successful
    const isConnected = await web3.eth.net.isListening();
    
    if (!isConnected) {
      throw new Error('Failed to connect to Ganache');
    }
    
    console.log('[OK] Successfully connected to Ganache at', ganacheUrl);
    console.log('');

    // Get all available accounts from Ganache
    const accounts = await web3.eth.getAccounts();
    
    if (accounts.length === 0) {
      console.log('No accounts found in Ganache');
      return;
    }

    console.log(`Found ${accounts.length} account(s):\n`);

    // Get balance for each account and display
    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      // Get balance in Wei (smallest unit)
      const balanceWei = await web3.eth.getBalance(account);
      // Convert Wei to Ether for readability
      const balanceEther = web3.utils.fromWei(balanceWei, 'ether');
      
      console.log(`Account ${i + 1}: ${account}`);
      console.log(`  Balance: ${balanceEther} ETH\n`);
    }

  } catch (error) {
    // Handle connection errors
    if (error.code === 'ECONNREFUSED') {
      console.error('[ERROR] Connection Error: Could not connect to Ganache');
      console.error('  Make sure Ganache is running at', ganacheUrl);
    } else if (error.message.includes('Failed to connect')) {
      console.error('[ERROR] Connection Error:', error.message);
      console.error('  Verify Ganache is running and accessible');
    } else {
      console.error('[ERROR] Error:', error.message);
    }
    process.exit(1);
  }
}

// Run the connection function
connectToGanache();

