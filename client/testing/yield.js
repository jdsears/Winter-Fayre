// For the client tests (vite.config.js, setupFiles): after every test the
// test's worker is given a moment to hear from the test runner.
//
// Some of the shootout's tests play thousands of kicks without a pause.
// A file of them can run for a minute without the worker once stopping
// to listen, and the runner then gives up on it as if it had hung. A
// moment between tests is enough, and changes nothing a test checks.

import { afterEach } from 'vitest'

afterEach(() => new Promise((resolve) => setImmediate(resolve)))
