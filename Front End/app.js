const contractAddress = "0xa7b870aa3b47876131dfdb76346408f055c15e5b";

const abi = [
    "function addEntry(string _service, string _username, bytes _encryptedPassword) public",
    "function getMyEntries() public view returns (tuple(string service, string username, bytes encryptedPassword, uint256 timestamp)[])",
    "function updateEntry(uint256 index, bytes _newEncryptedPassword) public",
    "function deleteEntry(uint256 index) public"
];

let signer = null;
let contract = null;

window.onload = () => {
    document.getElementById("walletAddress").innerText = "Wallet Not Connected";
    document.getElementById("entriesList").innerHTML = "";
    clearInputs();
};

function clearInputs() {
    document.getElementById("serviceInput").value = "";
    document.getElementById("usernameInput").value = "";
    document.getElementById("passwordInput").value = "";
}

function bytesToHex(bytes) {
    return "0x" + Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

function hexToBytes(hex) {
    if (hex.startsWith("0x")) {
        hex = hex.slice(2);
    }

    const bytes = new Uint8Array(hex.length / 2);

    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }

    return bytes;
}

async function getEncryptionKey(masterPassword) {
    const encoder = new TextEncoder();

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        encoder.encode(masterPassword),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    const salt = encoder.encode("towson-password-manager-salt");

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        {
            name: "AES-GCM",
            length: 256
        },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptPassword(password, masterPassword) {
    const encoder = new TextEncoder();
    const key = await getEncryptionKey(masterPassword);

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encoder.encode(password)
    );

    const encryptedBytes = new Uint8Array(encryptedBuffer);

    const combined = new Uint8Array(iv.length + encryptedBytes.length);
    combined.set(iv);
    combined.set(encryptedBytes, iv.length);

    return bytesToHex(combined);
}

async function decryptPassword(encryptedHex, masterPassword) {
    const combined = hexToBytes(encryptedHex);

    const iv = combined.slice(0, 12);
    const encryptedBytes = combined.slice(12);

    const key = await getEncryptionKey(masterPassword);

    const decryptedBuffer = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encryptedBytes
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
}

async function connectWallet() {
    if (typeof window.ethereum !== "undefined") {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);

            signer = await provider.getSigner();
            const address = await signer.getAddress();

            contract = new ethers.Contract(contractAddress, abi, signer);

            document.getElementById("walletAddress").innerText = `Connected: ${address}`;
            console.log("Wallet connected to:", address);

            await loadEntries();

        } catch (err) {
            console.error("Wallet connection failed:", err);
            alert("Wallet connection failed. Check console for details.");
        }
    } else {
        alert("MetaMask is not installed.");
    }
}

async function addEntry() {
    if (!contract) {
        alert("Please connect your wallet first!");
        return;
    }

    const service = document.getElementById("serviceInput").value;
    const username = document.getElementById("usernameInput").value;
    const password = document.getElementById("passwordInput").value;

    if (!service || !username || !password) {
        alert("Please fill in all fields.");
        return;
    }

    const masterPassword = prompt("Enter a master password for encryption. You will need this same master password to decrypt later.");

    if (!masterPassword) {
        alert("Master password is required.");
        return;
    }

    try {
        document.getElementById("addBtn").innerText = "Encrypting...";

        const encryptedPassword = await encryptPassword(password, masterPassword);

        console.log("Encrypted password:", encryptedPassword);
        console.log("Sending transaction to blockchain...");

        document.getElementById("addBtn").innerText = "Pending...";

        const tx = await contract.addEntry(service, username, encryptedPassword);
        await tx.wait();

        alert("Encrypted credential stored successfully!");

        document.getElementById("addBtn").innerText = "Encrypt & Store on Chain";
        clearInputs();
        await loadEntries();

    } catch (err) {
        console.error("Transaction failed:", err);
        alert("Transaction failed. Check console for details.");
        document.getElementById("addBtn").innerText = "Encrypt & Store on Chain";
    }
}

async function loadEntries() {
    if (!contract) return;

    try {
        console.log("Fetching entries from blockchain...");

        const entries = await contract.getMyEntries();
        const list = document.getElementById("entriesList");
        list.innerHTML = "";

        if (entries.length === 0) {
            list.innerHTML = "<p>No entries found for this address.</p>";
            return;
        }

        entries.forEach((entry, index) => {
            const div = document.createElement("div");
            div.className = "entry-item";

            div.innerHTML = `
                <strong>${entry.service}</strong>
                <p>User: ${entry.username}</p>
                <p>Encrypted Password: <span id="encrypted-${index}">${entry.encryptedPassword}</span></p>
                <p>Decrypted Password: <span id="decrypted-${index}">Hidden</span></p>
                <button onclick="revealPassword(${index}, '${entry.encryptedPassword}')">Decrypt Password</button>
                <button onclick="deleteEntry(${index})">Delete</button>
                <hr style="border: 0.5px solid #FFBB00;">
            `;

            list.appendChild(div);
        });

    } catch (err) {
        console.error("Failed to load entries:", err);
    }
}

async function revealPassword(index, encryptedPassword) {
    const masterPassword = prompt("Enter your master password to decrypt:");

    if (!masterPassword) {
        alert("Master password is required.");
        return;
    }

    try {
        const decryptedPassword = await decryptPassword(encryptedPassword, masterPassword);
        document.getElementById(`decrypted-${index}`).innerText = decryptedPassword;
    } catch (err) {
        console.error("Decryption failed:", err);
        alert("Decryption failed. Wrong master password or corrupted encrypted data.");
    }
}

async function deleteEntry(index) {
    if (!contract) {
        alert("Please connect your wallet first!");
        return;
    }

    try {
        const tx = await contract.deleteEntry(index);
        await tx.wait();

        alert("Entry deleted.");
        await loadEntries();

    } catch (err) {
        console.error("Delete failed:", err);
        alert("Delete failed. Check console for details.");
    }
}

document.getElementById("connectBtn").addEventListener("click", connectWallet);
document.getElementById("addBtn").addEventListener("click", addEntry);
document.getElementById("refreshBtn").addEventListener("click", loadEntries);