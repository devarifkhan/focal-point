import React from 'react';
import { createRoot } from 'react-dom/client';
import "../../assets/css/index.css";
import Verify from './Verify';

const container = document.getElementById('app-container');
const root = createRoot(container);
root.render(<Verify/>); 