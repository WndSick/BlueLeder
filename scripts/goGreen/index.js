import fs from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHANGES_PATH = path.join(__dirname, "changes.txt");
const README_PATH = path.join(__dirname, "..", "..", "README.md");

const COUNT = parseInt(process.env.GOGREEN_COUNT || "100", 10);
const DRY_RUN = (process.env.GOGREEN_DRY_RUN || "true").toLowerCase() === "true";
const PUSH = (process.env.GOGREEN_PUSH || "false").toLowerCase() === "true";

function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeDate(weeks, days) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    d.setDate(d.getDate() + 1 + weeks * 7 + days);
    return d.toISOString();
}

function run() {
    let lines = [];
    try {
        const raw = fs.readFileSync(CHANGES_PATH, "utf8");
        lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    } catch (e) {
        console.error(`Could not read changes.txt at ${CHANGES_PATH}`);
        process.exit(1);
    }

    console.log(`goGreen: count=${COUNT} dryRun=${DRY_RUN} push=${PUSH}`);

    for (let i = 0; i < COUNT; i++) {
        const w = randInt(0, 54);
        const d = randInt(0, 6);
        const date = makeDate(w, d);
        const msg = lines.length ? lines[randInt(0, lines.length - 1)] : `goGreen commit ${i + 1}`;

        const entry = `\n- ${msg} (${date})\n`;

        console.log(`[${i + 1}/${COUNT}] ${date} -> ${msg}`);

        // Append to README
        fs.appendFileSync(README_PATH, entry);

        // Stage and commit with author/committer date set
        const commitCommand = `git add "${README_PATH}" && git commit -m "${msg}" --date "${date}" "${README_PATH}"`;

        if (DRY_RUN) {
            console.log(`DRY RUN: ${commitCommand}`);
        } else {
            try {
                execSync(commitCommand, { stdio: "inherit", env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
            } catch (e) {
                console.error("Git command failed:", e.message);
            }
        }
    }

    if (!DRY_RUN && PUSH) {
        try {
            console.log("Pushing commits to remote...");
            execSync("git push", { stdio: "inherit" });
        } catch (e) {
            console.error("Failed to push:", e.message);
        }
    }

    console.log("goGreen finished.");
}

run();
