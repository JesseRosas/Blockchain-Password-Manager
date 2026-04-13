// Replace with your actual deployed contract address from Hardhat/Remix
const contractAddress = "deployed_contract_adress"; 

const abi = [
    "function addEntry(string _service, string _username, bytes _encryptedPassword) public",
    "function getMyEntries() public view returns (tuple(string service, string username, bytes encryptedPassword, uint256 timestamp)[])",
    "function deleteEntry(uint256 index) public"
];

let signer = null;
let contract = null;

// 1. Forced UI Reset on Load
window.onload = () => {
    console.log("Page reloaded. Resetting UI state...");
    document.getElementById('walletAddress').innerText = "Wallet Not Connected";
    document.getElementById('entriesList').innerHTML = "";
    clearInputs();
};

function clearInputs() {
    document.getElementById('serviceInput').value = "";
    document.getElementById('usernameInput').value = "";
    document.getElementById('passwordInput').value = "";
}

async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            
            // This forces the MetaMask popup if not already connected
            signer = await provider.getSigner();
            const address = await signer.getAddress();
            
            contract = new ethers.Contract(contractAddress, abi, signer);
            
            document.getElementById('walletAddress').innerText = `Connected: ${address}`;
            console.log("Wallet connected to:", address);
            
            // Load entries automatically upon successful connection
            await loadEntries(); 
        } catch (err) {
            console.error("User denied account access or error occurred:", err);
        }
    } else {
        alert("MetaMask is not installed. Please install it to use this Tiger Tech tool.");
    }
}

async function addEntry() {
    if (!contract) {
        alert("Please connect your wallet first!");
        return;
    }

    const service = document.getElementById('serviceInput').value;
    const username = document.getElementById('usernameInput').value;
    const password = document.getElementById('passwordInput').value;

    if (!service || !username || !password) {
        alert("Please fill in all fields.");
        return;
    }

    console.log("Hashing password for service:", service);

    try {
        // SHA-256 Hashing logic
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashedPassword = "0x" + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        console.log("Sending transaction to blockchain...");
        
        // Interaction with PasswordKeychain.sol 
        const tx = await contract.addEntry(service, username, hashedPassword);
        
        document.getElementById('addBtn').innerText = "Pending...";
        await tx.wait(); // Waiting for the block to mine
        
        console.log("Transaction confirmed!");
        alert("Credential hash stored successfully!");
        
        document.getElementById('addBtn').innerText = "Hash & Store on Chain";
        clearInputs(); // Clear credentials so they must be re-entered
        await loadEntries(); // Refresh the list
        
    } catch (err) {
        console.error("Transaction failed:", err);
        alert("Transaction failed. Check console for details.");
        document.getElementById('addBtn').innerText = "Hash & Store on Chain";
    }
}

async function loadEntries() {
    if (!contract) return;

    try {
        console.log("Fetching entries from blockchain...");
        const entries = await contract.getMyEntries();
        const list = document.getElementById('entriesList');
        list.innerHTML = "";

        if (entries.length === 0) {
            list.innerHTML = "<p>No entries found for this address.</p>";
            return;
        }

        // Displaying entries in the UI
        entries.forEach((entry, index) => {
            const div = document.createElement('div');
            div.className = "entry-item";
            div.innerHTML = `
                <strong>${entry.service}</strong> 
                <p>User: ${entry.username}</p>
                <span>Hash (SHA-256): ${entry.encryptedPassword}</span>
                <hr style="border: 0.5px solid #FFBB00;">
            `;
            list.appendChild(div);
        });
    } catch (err) {
        console.error("Failed to load entries:", err);
    }
}

// Event Listeners
document.getElementById('connectBtn').addEventListener('click', connectWallet);
document.getElementById('addBtn').addEventListener('click', addEntry);
document.getElementById('refreshBtn').addEventListener('click', loadEntries);