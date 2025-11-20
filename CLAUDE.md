# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

toric-scope is an online toric variety visualizer. Toric varieties are geometric objects in algebraic geometry defined by combinatorial data (fans, polytopes). This project aims to provide interactive visualization of these mathematical structures.

**IMPORTANT: This is NOT a 3D visualization project. Do not suggest Three.js, WebGL, or any 3D rendering libraries.**

## Current Status

The project has basic infrastructure set up:
- Backend: Python/FastAPI server with CORS configured
  - Health check endpoints
  - Placeholder API endpoints for toric varieties
- Frontend: React + TypeScript with Vite
  - Default template (not yet customized)
  - Ready for development

## Development Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Architecture

**Tech Stack:**
- Frontend: React + TypeScript + Vite
- Backend: Python + FastAPI
- Visualization: 2D canvas/SVG (NOT 3D)
- Mathematical computation libraries: TBD
- Data structures for representing fans, polytopes, and toric varieties: TBD
