# Adaptive Resource Quarantine Dashboard

A React and TypeScript dashboard prototype for the Adaptive Resource Quarantine (ARQ) project. The interface follows the project review decks: process telemetry, anomaly scores, graduated quarantine states, recovery, event history, and the Review 3 evaluation plan.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Demo scope

This repository currently contains a front-end simulation. Process rows and telemetry are sample data. Quarantine, release, and demo replay actions update the browser state only. The application does not inspect, signal, throttle, or otherwise control operating-system processes.

The Evaluation page shows the five planned experiments and proposed acceptance targets from the Review 2/3 deck. It leaves measured results blank until real experiment outputs are available.
