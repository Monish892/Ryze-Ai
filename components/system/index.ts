import Button from './Button';
import Card from './Card';
import Input from './Input';
import Table from './Table';
import Modal from './Modal';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Chart from './Chart';
import ColumnLayout from './ColumnLayout';
import RowLayout from './RowLayout';
import GridLayout from './GridLayout';

export const ALLOWED_COMPONENTS = {
  Button,
  Card,
  Input,
  Table,
  Modal,
  Sidebar,
  Navbar,
  Chart,
  ColumnLayout,
  RowLayout,
  GridLayout,
} as const;

export type AllowedComponentName = keyof typeof ALLOWED_COMPONENTS;
export type LayoutComponentName = 'ColumnLayout' | 'RowLayout' | 'GridLayout';
export type UIComponentName = Exclude<AllowedComponentName, LayoutComponentName>;
