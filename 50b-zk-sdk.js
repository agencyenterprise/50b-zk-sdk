import { execSync } from "child_process";
import fs from "fs";
import crypto from "crypto";

export function createJob() {
  return {
    jobId: "123",
    base64EnclavePublicKey:
      "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUE3OG5DUXZhMTFsZkRWVXAxOUFMZgpZSTJtSkpYQWpDYVNtRUJqSnYxdi9UUE90Ylc1alF0K3ZOMkZqd3QxVXVMU0lRWE9pUDN0M3c1MEhPUXdMMlh3Cks0OVN5Wk1JVGh5dmRNU1NTNVlwNUFrQi9CaDdVNTl1M2FVNTNrbkt5WlJ2Q3Y3eEJkdDJqcThRVkhZdUZLSTQKbXlFMGRLMWlkMkl0eWUyV2MzSVdob0tMUlZjTVprOUFxS1B2NGJ0Y1k3T3JaeEZkK1k3SzBYM1FBSUNMWUwxQQpSTGVaY2ZwTzlrRG1RUTFXYnZoNWFySm85M1RENml6aVIybjhEK3RqSzN6M3pTUFNZSEIwbEhSTFVyOEdJUjBNCi9GOFZBcDRjSVRsSkdIQVp6aEpmWE50bmNUaUZDNGNKblM5cVg3dzR0anpKMUF3ckg3K3JPVXBGTmZWR1NuWWoKeHdJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0t",
  };
}

export function startJob(
  jobId,
  base64R1cs,
  base64EncryptedWitness,
  base64EncryptedAesKey,
  base64AesIv
) {
  console.log(
    `jobId=${jobId}&r1cs=${base64R1cs}&witness=${base64EncryptedWitness}&key=${base64EncryptedAesKey}&iv=${base64AesIv}`
  );
}

function compileCircom(circuitPath) {
  execSync(`circom ${circuitPath} --r1cs --wasm -o ./output`);
}

function generateWitness(circuitName, inputsPath) {
  fs.writeFileSync(
    `./output/${circuitName}_js/package.json`,
    '{"type": "commonjs"}'
  );

  execSync(
    `node ./output/${circuitName}_js/generate_witness.js ./output/${circuitName}_js/${circuitName}.wasm ${inputsPath} ./output/${circuitName}.wtns`
  );
}

export function generate50bZkArguments(circuitPath, inputsPath) {
  if (!fs.existsSync("./output")) {
    fs.mkdirSync("./output");
  }

  const circuitName = circuitPath.split("/").pop().split(".")[0];

  compileCircom(circuitPath);
  generateWitness(circuitName, inputsPath);

  const base64R1cs = fs
    .readFileSync(`./output/${circuitName}.r1cs`)
    .toString("base64url");
  const base64Witness = fs
    .readFileSync(`./output/${circuitName}.wtns`)
    .toString("base64url");

  fs.rmSync("./output", { recursive: true });

  return { base64R1cs, base64Witness };
}

export function encryptWitness(base64EnclavePublicKey, base64Witness) {
  const enclavePublicKey = Buffer.from(
    base64EnclavePublicKey,
    "base64url"
  ).toString("utf-8");

  const aes_key = crypto.randomBytes(32);
  const aes_iv = crypto.randomBytes(16);
  const cipher_aes = crypto.createCipheriv("aes-256-cbc", aes_key, aes_iv);

  const base64EncryptedWitness = Buffer.concat([
    cipher_aes.update(Buffer.from(base64Witness, "utf8")),
    cipher_aes.final(),
  ]).toString("base64url");

  const base64EncryptedAesKey = crypto
    .publicEncrypt(
      {
        key: enclavePublicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      aes_key
    )
    .toString("base64url");

  return {
    base64EncryptedWitness,
    base64EncryptedAesKey,
    base64AesIv: aes_iv.toString("base64url"),
  };
}
