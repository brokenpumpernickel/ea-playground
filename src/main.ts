import { mount } from 'svelte';
import './ui/app.css';
import App from './ui/App.svelte';

mount(App, { target: document.getElementById('app')! });
