import hre from "hardhat";
import { expect } from "chai";

describe("PasswordKeychain", function () {
    it("Adding a new entry", async function () {
        const { ethers } = await hre.network.connect();

        const factory = await ethers.getContractFactory("PasswordKeychain");
        const contract = await factory.deploy();
        await contract.waitForDeployment();

        const [owner] = await ethers.getSigners();

        // Add a new entry
        const service = "Twitter";
        const username = "owner123";
        const password = "0x7375706572536563726574313233";

        const tx = await contract.connect(owner).addEntry(service, username, password);
        await tx.wait();

        const entries = await contract.connect(owner).getMyEntries();

        // Verify the entry was added
        expect(entries.length).to.equal(1);
        expect(entries[0].service).to.equal(service);
        expect(entries[0].username).to.equal(username);
        expect(entries[0].encryptedPassword).to.equal(password);
    });

    it("Updating an existing entry", async function () {
        const { ethers } = await hre.network.connect();

        const factory = await ethers.getContractFactory("PasswordKeychain");
        const contract = await factory.deploy();
        await contract.waitForDeployment();

        const [owner] = await ethers.getSigners();

        // Add an initial entry
        const service = "Twitter";
        const username = "owner123";
        const originalPassword = "0x7375706572536563726574313233"; // "superSecret123"

        await contract.connect(owner).addEntry(service, username, originalPassword);

        const entriesBefore = await contract.connect(owner).getMyEntries();
        const originalTimestamp = entriesBefore[0].timestamp;

        // Update the entry
        const newPassword = "0x6e657750617373776f7264313233"; // "newPassword123"
        const tx = await contract.connect(owner).updateEntry(0, newPassword);
        await tx.wait();

        const entriesAfter = await contract.connect(owner).getMyEntries();

        // Verify that the password and timestamp were updated
        expect(entriesAfter[0].encryptedPassword).to.equal(newPassword);
        expect(entriesAfter[0].service).to.equal(service); // unchanged
        expect(entriesAfter[0].username).to.equal(username); // unchanged
        expect(entriesAfter[0].timestamp).to.be.greaterThan(originalTimestamp);
    });

    it("Deleting an entry", async function () {
        const { ethers } = await hre.network.connect();

        const factory = await ethers.getContractFactory("PasswordKeychain");
        const contract = await factory.deploy();
        await contract.waitForDeployment();

        const [owner] = await ethers.getSigners();

        // Add two entries
        const entry1 = { service: "Twitter", username: "user1", password: "0x73757065725331" }; // "superS1"
        const entry2 = { service: "Facebook", username: "user2", password: "0x73757065724632" }; // "superF2"

        await contract.connect(owner).addEntry(entry1.service, entry1.username, entry1.password);
        await contract.connect(owner).addEntry(entry2.service, entry2.username, entry2.password);

        const entriesBefore = await contract.connect(owner).getMyEntries();
        expect(entriesBefore.length).to.equal(2);

        // Delete the first entry (index 0)
        const tx = await contract.connect(owner).deleteEntry(0);
        await tx.wait();

        const entriesAfter = await contract.connect(owner).getMyEntries();

        // Verify that only the second entry remains
        expect(entriesAfter.length).to.equal(1);
        expect(entriesAfter[0].service).to.equal(entry2.service);
        expect(entriesAfter[0].username).to.equal(entry2.username);
        expect(entriesAfter[0].encryptedPassword).to.equal(entry2.password);
    });

    it("Add multiple entries for one user", async function () {
    const { ethers } = await hre.network.connect();
    const factory = await ethers.getContractFactory("PasswordKeychain");
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const [owner] = await ethers.getSigners();

    const entries = [
        { service: "S1", username: "U1", password: "0x61" }, // "a"
        { service: "S2", username: "U2", password: "0x62" }, // "b"
        { service: "S3", username: "U3", password: "0x63" }  // "c"
    ];

    for (const e of entries) {
        await contract.connect(owner).addEntry(e.service, e.username, e.password);
    }

    const stored = await contract.connect(owner).getMyEntries();
    expect(stored.length).to.equal(3);
    expect(stored[0].service).to.equal("S1");
    expect(stored[2].username).to.equal("U3");
    });

    it("Retrieve all entries for a user", async function () {
    const { ethers } = await hre.network.connect();
    const factory = await ethers.getContractFactory("PasswordKeychain");
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const [user1, user2] = await ethers.getSigners();

    // Add entries for user1
    const entriesUser1 = [
        { service: "Twitter", username: "user1", password: "0x61737331" }, // "ass1"
        { service: "Facebook", username: "user1_fb", password: "0x62626232" } // "bbb2"
    ];

    for (const e of entriesUser1) {
        await contract.connect(user1).addEntry(e.service, e.username, e.password);
    }

    // Add entries for user2
    await contract.connect(user2).addEntry("Instagram", "user2_insta", "0x63636333"); // "ccc3"

    // Retrieve entries for user1
    const user1Stored = await contract.connect(user1).getMyEntries();
    expect(user1Stored.length).to.equal(2);
    expect(user1Stored[0].service).to.equal("Twitter");
    expect(user1Stored[1].username).to.equal("user1_fb");

    // Retrieve entries for user2
    const user2Stored = await contract.connect(user2).getMyEntries();
    expect(user2Stored.length).to.equal(1);
    expect(user2Stored[0].service).to.equal("Instagram");
    expect(user2Stored[0].username).to.equal("user2_insta");
    });

    it("Update or delete on empty keychain should fail", async function () {
    const { ethers } = await hre.network.connect();
    const factory = await ethers.getContractFactory("PasswordKeychain");
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const [user] = await ethers.getSigners();

    await expect(contract.connect(user).updateEntry(0, "0x61"))
        .to.be.revertedWith("Invalid index");
    await expect(contract.connect(user).deleteEntry(0))
        .to.be.revertedWith("Invalid index");
    });

    it("Adding duplicate entries is allowed", async function () {
    const { ethers } = await hre.network.connect();
    const factory = await ethers.getContractFactory("PasswordKeychain");
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const [user] = await ethers.getSigners();

    const service = "Twitter";
    const username = "user1";
    const password = "0x61737331"; // "ass1"

    await contract.connect(user).addEntry(service, username, password);
    await contract.connect(user).addEntry(service, username, password);

    const entries = await contract.connect(user).getMyEntries();
    expect(entries.length).to.equal(2);
    });

    it("Add and retrieve many entries", async function () {
    const { ethers } = await hre.network.connect();
    const factory = await ethers.getContractFactory("PasswordKeychain");
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    const [user] = await ethers.getSigners();

    for (let i = 0; i < 20; i++) {
        const service = `Service${i}`;
        const username = `User${i}`;
        const password = "0x61"; // "a"
        await contract.connect(user).addEntry(service, username, password);
    }

    const entries = await contract.connect(user).getMyEntries();
    expect(entries.length).to.equal(20);
    expect(entries[0].service).to.equal("Service0");
    expect(entries[19].username).to.equal("User19");
    });

    it("Other users cannot access or modify another user's entries", async function () {
        const { ethers } = await hre.network.connect();
        const factory = await ethers.getContractFactory("PasswordKeychain");
        const contract = await factory.deploy();
        await contract.waitForDeployment();

        const [user1, user2] = await ethers.getSigners();

        // User1 adds an entry
        await contract.connect(user1).addEntry(
            "Twitter",
            "user1_account",
            "0x61737331" // "ass1"
        );

        // User2 tries to read User1's entries
        const user2Entries = await contract.connect(user2).getMyEntries();
        expect(user2Entries.length).to.equal(0);

        // User2 tries to update User1's entry (should fail)
        await expect(
            contract.connect(user2).updateEntry(0, "0x62626232") // "bbb2"
        ).to.be.revertedWith("Invalid index");

        // User2 tries to delete User1's entry (should fail)
        await expect(
            contract.connect(user2).deleteEntry(0)
        ).to.be.revertedWith("Invalid index");

        // User1 can still access their own entry
        const user1Entries = await contract.connect(user1).getMyEntries();
        expect(user1Entries.length).to.equal(1);
        expect(user1Entries[0].service).to.equal("Twitter");
        expect(user1Entries[0].username).to.equal("user1_account");
    });
});