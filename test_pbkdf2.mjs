import crypto from 'crypto';
const webcrypto = crypto.webcrypto;

async function test() {
  const enc = new TextEncoder();
  const salt = enc.encode("02803aa3-9451-4b23-b229-9823a8a79cac");
  
  const key1 = await webcrypto.subtle.importKey("raw", enc.encode("passwordA"), { name: "PBKDF2" }, false, ["deriveKey"]);
  const k1 = await webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key1,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  const key2 = await webcrypto.subtle.importKey("raw", enc.encode("passwordB"), { name: "PBKDF2" }, false, ["deriveKey"]);
  const k2 = await webcrypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key2,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  const raw1 = await webcrypto.subtle.exportKey("raw", k1);
  const raw2 = await webcrypto.subtle.exportKey("raw", k2);
  
  const b1 = Buffer.from(raw1).toString('hex');
  const b2 = Buffer.from(raw2).toString('hex');
  
  console.log("k1:", b1);
  console.log("k2:", b2);
  console.log("Match:", b1 === b2);
}

test();
