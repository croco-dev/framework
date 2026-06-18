#!/usr/bin/env node
import { runMain } from "citty";
import { createCrocoCommand } from "../commands/root.js";

runMain(createCrocoCommand());
