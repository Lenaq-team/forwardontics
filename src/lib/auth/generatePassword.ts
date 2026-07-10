import { randomBytes } from "crypto";

const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const SPECIALS = "!@#$%^&*";
const ALL = UPPERCASE + LOWERCASE + DIGITS + SPECIALS;

function randomIndex(max: number): number {
    // Rejection-sample to avoid modulo bias
    const limit = 256 - (256 % max);
    let byte: number;
    do {
        byte = randomBytes(1)[0];
    } while (byte >= limit);
    return byte % max;
}

function pick(pool: string): string {
    return pool[randomIndex(pool.length)];
}

/**
 * Generates a 16-character cryptographically secure password that meets
 * the Cognito user pool policy: upper, lower, digit, special character.
 */
export function generateSecurePassword(): string {
    // Guarantee at least one character from each required pool
    const required = [
        pick(UPPERCASE),
        pick(LOWERCASE),
        pick(DIGITS),
        pick(SPECIALS),
    ];

    // Fill remaining 12 characters from the full character set
    const rest = Array.from({ length: 12 }, () => pick(ALL));

    // Shuffle all 16 characters using Fisher-Yates
    const chars = [...required, ...rest];
    for (let i = chars.length - 1; i > 0; i--) {
        const j = randomIndex(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return chars.join("");
}
