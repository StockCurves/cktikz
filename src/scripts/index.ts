/**
 * The main source file. Does only include {@link MainController}, which does the actual work.
 */

import { bootstrapRuntimeConfig } from "./config/runtimeBootstrap"

bootstrapRuntimeConfig()

const { MainController } = await import("./internal")

// @ts-ignore
window.mainController = MainController.instance
