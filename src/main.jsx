import { render } from 'preact';
import { App } from './App';
import './style.css';

// Инициализация Telegram WebApp
if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
}

render(<App />, document.getElementById('app'));

