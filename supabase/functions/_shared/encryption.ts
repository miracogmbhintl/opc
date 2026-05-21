/**
 * Token Encryption Helper Module
 * AES-GCM encryption for OAuth tokens
 */

import {
  encode as base64Encode,
  decode as base64Decode,
} from "https://deno.land/std@0.177.0/encoding/base64.ts";

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(secret);

  const keyHash = await crypto.subtle.digest("SHA-256", keyMaterial);

  return await crypto.subtle.importKey(
    "raw",
    keyHash,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptToken(
  token: string,
  encryptionSecret: string,
): Promise<string> {
  const key = await deriveKey(encryptionSecret);
  const encoder = new TextEncoder();
  const data = encoder.encode(token);

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data,
  );

  const ivBase64 = base64Encode(iv);
  const ciphertextBase64 = base64Encode(new Uint8Array(ciphertext));

  return `${ivBase64}:${ciphertextBase64}`;
}

export async function decryptToken(
  encryptedToken: string,
  encryptionSecret: string,
): Promise<string> {
  const [ivBase64, ciphertextBase64] = encryptedToken.split(":");

  if (!ivBase64 || !ciphertextBase64) {
    throw new Error("Invalid encrypted token format");
  }

  const key = await deriveKey(encryptionSecret);
  const iv = base64Decode(ivBase64);
  const ciphertext = base64Decode(ciphertextBase64);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export async function encryptTokens(
  tokens: { access_token: string; refresh_token?: string },
  encryptionSecret: string,
): Promise<{ encrypted_access_token: string; encrypted_refresh_token?: string }> {
  const encrypted_access_token = await encryptToken(
    tokens.access_token,
    encryptionSecret,
  );

  let encrypted_refresh_token: string | undefined;
  if (tokens.refresh_token) {
    encrypted_refresh_token = await encryptToken(
      tokens.refresh_token,
      encryptionSecret,
    );
  }

  return {
    encrypted_access_token,
    encrypted_refresh_token,
  };
}