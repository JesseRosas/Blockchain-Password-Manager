const contractAddress = "0xa7b870aa3b47876131dfdb76346408f055c15e5b";

const abi = [
    "function addEntry(string _service, string _username, bytes _encryptedPassword) public",
    "function getMyEntries() public view returns (tuple(string service, string username, bytes encryptedPassword, uint256 timestamp)[])",
    "function updateEntry(uint256 index, bytes _newEncryptedPassword) public",
    "function deleteEntry(uint256 index) public"
];

let signer = null;
let contract = null;

// ─── Password Generator ───────────────────────────────────────────────────────
const CHARSET = {
    upper:   "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lower:   "abcdefghijklmnopqrstuvwxyz",
    digits:  "0123456789",
    symbols: "!@#$%^&*()-_=+[]{}|;:,.<>?"
};


// Generates a cryptographically secure random password.
function generateSecurePassword(length = 16) {
    const allChars = CHARSET.upper + CHARSET.lower + CHARSET.digits + CHARSET.symbols;

    // Guarantee at least one of each character class
    const guaranteed = [
        randomChar(CHARSET.upper),
        randomChar(CHARSET.lower),
        randomChar(CHARSET.digits),
        randomChar(CHARSET.symbols)
    ];

    const remaining = Array.from(
        { length: length - guaranteed.length },
        () => randomChar(allChars)
    );

    const combined = [...guaranteed, ...remaining];
    shuffleArray(combined);

    return combined.join("");
}


function randomChar(chars) {
    const array = new Uint32Array(1);
    const limit = Math.floor(0xFFFFFFFF / chars.length) * chars.length;
    let value;
    do {
        crypto.getRandomValues(array);
        value = array[0];
    } while (value >= limit);
    return chars[value % chars.length];
}
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const array = new Uint32Array(1);
        const limit = Math.floor(0xFFFFFFFF / (i + 1)) * (i + 1);
        let value;
        do {
            crypto.getRandomValues(array);
            value = array[0];
        } while (value >= limit);
        const j = value % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

 // Estimates password strength and returns a label/color 
function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { label: "Weak",   color: "#e74c3c" };
    if (score <= 4) return { label: "Fair",   color: "#f39c12" };
    if (score <= 5) return { label: "Strong", color: "#27ae60" };
    return          { label: "Very Strong",   color: "#1abc9c" };
}

window.onload = () => {
    document.getElementById("walletAddress").innerText = "Wallet Not Connected";
    document.getElementById("entriesList").innerHTML = "";
    clearInputs();

    // Wire up the generate button
    document.getElementById("generateBtn").addEventListener("click", handleGenerate);

    // Wire up the copy button
    document.getElementById("copyBtn").addEventListener("click", copyPasswordToClipboard);

    // Update strength meter whenever the password field changes
    document.getElementById("passwordInput").addEventListener("input", (e) => {
        updateStrengthMeter(e.target.value);
    });
};

function handleGenerate() {
    const password = generateSecurePassword(18);
    const input = document.getElementById("passwordInput");
    input.value = password;
    input.type = "text"; // briefly reveal so the user can see it
    updateStrengthMeter(password);

    // Flash the generate button
    const btn = document.getElementById("generateBtn");
    btn.innerText = "✓ Generated!";
    btn.style.backgroundColor = "#27ae60";
    btn.style.color = "#fff";
    setTimeout(() => {
        btn.innerText = "⚡ Generate";
        btn.style.backgroundColor = "";
        btn.style.color = "";
    }, 1500);
}

async function copyPasswordToClipboard() {
    const input = document.getElementById("passwordInput");
    const password = input.value;

    if (!password) {
        alert("No password to copy. Generate or enter one first.");
        return;
    }

    const btn = document.getElementById("copyBtn");

    try {
        await navigator.clipboard.writeText(password);

        // Success feedback
        btn.innerText = "✓ Copied!";
        btn.style.backgroundColor = "#27ae60";
        btn.style.color = "#fff";
    } catch (err) {
        input.type = "text";
        input.select();
        input.setSelectionRange(0, 99999); // mobile support
        const success = document.execCommand("copy");

        btn.innerText = success ? "✓ Copied!" : "✗ Failed";
        btn.style.backgroundColor = success ? "#27ae60" : "#e74c3c";
        btn.style.color = "#fff";
    }

    setTimeout(() => {
        btn.innerText = "⧉ Copy";
        btn.style.backgroundColor = "";
        btn.style.color = "";
    }, 1500);
}

function updateStrengthMeter(password) {
    const bar   = document.getElementById("strengthBar");
    const label = document.getElementById("strengthLabel");

    if (!password) {
        bar.style.width = "0%";
        bar.style.backgroundColor = "#ccc";
        label.innerText = "";
        return;
    }

    const { label: text, color } = getPasswordStrength(password);
    const widths = { "Weak": "25%", "Fair": "55%", "Strong": "80%", "Very Strong": "100%" };

    bar.style.width           = widths[text] ?? "100%";
    bar.style.backgroundColor = color;
    label.innerText           = text;
    label.style.color         = color;
}

function clearInputs() {
    document.getElementById("serviceInput").value  = "";
    document.getElementById("usernameInput").value = "";
    document.getElementById("passwordInput").value = "";
    document.getElementById("passwordInput").type  = "password";
    updateStrengthMeter("");
}

function bytesToHex(bytes) {
    return "0x" + Array.from(bytes)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

function hexToBytes(hex) {
    if (hex.startsWith("0x")) hex = hex.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

async function getEncryptionKey(masterPassword) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw", encoder.encode(masterPassword), "PBKDF2", false, ["deriveKey"]
    );
    const salt = encoder.encode("towson-password-manager-salt");
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function encryptPassword(password, masterPassword) {
    const encoder = new TextEncoder();
    const key = await getEncryptionKey(masterPassword);
    const iv  = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, key, encoder.encode(password)
    );
    const encryptedBytes = new Uint8Array(encryptedBuffer);
    const combined = new Uint8Array(iv.length + encryptedBytes.length);
    combined.set(iv);
    combined.set(encryptedBytes, iv.length);
    return bytesToHex(combined);
}

async function decryptPassword(encryptedHex, masterPassword) {
    const combined       = hexToBytes(encryptedHex);
    const iv             = combined.slice(0, 12);
    const encryptedBytes = combined.slice(12);
    const key = await getEncryptionKey(masterPassword);
    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv }, key, encryptedBytes
    );
    return new TextDecoder().decode(decryptedBuffer);
}

async function connectWallet() {
    if (typeof window.ethereum !== "undefined") {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            signer   = await provider.getSigner();
            const address = await signer.getAddress();
            contract = new ethers.Contract(contractAddress, abi, signer);
            document.getElementById("walletAddress").innerText = `Connected: ${address}`;
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
    if (!contract) { alert("Please connect your wallet first!"); return; }

    const service  = document.getElementById("serviceInput").value;
    const username = document.getElementById("usernameInput").value;
    const password = document.getElementById("passwordInput").value;

    if (!service || !username || !password) { alert("Please fill in all fields."); return; }

    const masterPassword = prompt("Enter a master password for encryption. You will need this same master password to decrypt later.");
    if (!masterPassword) { alert("Master password is required."); return; }

    try {
        document.getElementById("addBtn").innerText = "Encrypting...";
        const encryptedPassword = await encryptPassword(password, masterPassword);
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
        const entries = await contract.getMyEntries();
        const list    = document.getElementById("entriesList");
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
    if (!masterPassword) { alert("Master password is required."); return; }
    try {
        const decryptedPassword = await decryptPassword(encryptedPassword, masterPassword);
        document.getElementById(`decrypted-${index}`).innerText = decryptedPassword;
    } catch (err) {
        console.error("Decryption failed:", err);
        alert("Decryption failed. Wrong master password or corrupted data.");
    }
}

async function deleteEntry(index) {
    if (!contract) { alert("Please connect your wallet first!"); return; }
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
