const { spawn } = require("child_process")
const path = require("path")

const projectRoot = path.resolve(__dirname, "..")
const processes = []
let shuttingDown = false

function startProcess(label, command, args) {
	const child = spawn(command, args, {
		cwd: projectRoot,
		stdio: "inherit",
		shell: false,
	})

	child.on("exit", (code, signal) => {
		if (shuttingDown) return

		const reason = signal ? `signal ${signal}` : `code ${code}`
		console.error(`[dev] ${label} exited with ${reason}`)
		shutdown(code ?? 1)
	})

	child.on("error", (error) => {
		if (shuttingDown) return

		console.error(`[dev] failed to start ${label}: ${error.message}`)
		shutdown(1)
	})

	processes.push(child)
}

function shutdown(exitCode = 0) {
	if (shuttingDown) return
	shuttingDown = true

	for (const child of processes) {
		if (!child.killed) {
			child.kill("SIGTERM")
		}
	}

	process.exit(exitCode)
}

process.on("SIGINT", () => shutdown(0))
process.on("SIGTERM", () => shutdown(0))

startProcess("api server", process.execPath, ["server.js"])
if (process.platform === "win32") {
	startProcess("parcel", "cmd.exe", ["/c", "npm", "run", "start:client"])
} else {
	startProcess("parcel", "npm", ["run", "start:client"])
}
