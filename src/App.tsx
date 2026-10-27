import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  ShieldCheck,
  Tv,
  Laptop,
  Activity,
  Zap,
  Layers,
  X,
  AlertCircle,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  Settings,
  User,
  ArrowLeft,
} from 'lucide-react';

import ninjaAvatar from './assets/avtar/ninja.png';
import pandaAvatar from './assets/avtar/panda.png';
import rabbitAvatar from './assets/avtar/rabbit.png';
import savannahAvatar from './assets/avtar/savannah.png';
import soccerAvatar from './assets/avtar/soccer.png';
import tigerAvatar from './assets/avtar/tiger.png';
import appIcon from './assets/icon.png';

interface AndroidDownloaderPluginInterface {
  downloadToPublicFolder(options: {
    fileName: string;
    base64Data: string;
    mimeType?: string;
  }): Promise<{ success: boolean; path: string; message: string }>;
}

const AndroidDownloader = registerPlugin<AndroidDownloaderPluginInterface>('AndroidDownloader');

// --- Types ---
export type Category = 'Streaming' | 'Software' | 'Health' | 'Utilities' | 'Other';
export type BillingCycle = 'Monthly' | 'Yearly';
export type Currency = '$' | '€' | '£' | '₹';

export interface Subscription {
  id: string;
  name: string;
  price: number;
  currency: Currency;
  billingCycle: BillingCycle;
  renewalDate: string; // YYYY-MM-DD
  category: Category;
  notes?: string;
  createdAt: number;
}

const STORAGE_KEY = 'subtrack_data';
const CURRENCY_STORAGE_KEY = 'subtrack_preferred_currency';
const USER_NAME_KEY = 'subtrack_user_name';
const USER_AVATAR_KEY = 'subtrack_user_avatar';
const ONBOARDING_KEY = 'subtrack_onboarding_completed';

const AVATAR_OPTIONS = [
  { id: 'initials', label: 'Initials', isInitials: true },
  { id: 'ninja', label: 'Ninja', src: ninjaAvatar },
  { id: 'panda', label: 'Panda', src: pandaAvatar },
  { id: 'rabbit', label: 'Rabbit', src: rabbitAvatar },
  { id: 'savannah', label: 'Savannah', src: savannahAvatar },
  { id: 'soccer', label: 'Soccer', src: soccerAvatar },
  { id: 'tiger', label: 'Tiger', src: tigerAvatar },
];

// Dynamic relative date generator
function getFutureDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

// Clean date formatting
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Calculate days remaining
function getDaysUntil(dateStr: string): number {
  if (!dateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = dateStr.split('-').map(Number);
  const renewal = new Date(year, month - 1, day);
  renewal.setHours(0, 0, 0, 0);

  const diffTime = renewal.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// Compute initials from first name and last name
function getUserInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'JD';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Google Material Category Palette (Flat, No Shine)
const CATEGORY_CONFIG: Record<
  Category,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    badgeStyle: string;
    barColor: string;
    cardBorder: string;
  }
> = {
  Streaming: {
    label: 'Streaming',
    icon: Tv,
    iconBg: 'bg-[#fce8e6]',
    iconColor: 'text-[#d93025]',
    badgeStyle: 'bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf]',
    barColor: 'bg-[#ea4335]', // Google Red
    cardBorder: 'border-[#ea4335]',
  },
  Software: {
    label: 'Software',
    icon: Laptop,
    iconBg: 'bg-[#e8f0fe]',
    iconColor: 'text-[#1a73e8]',
    badgeStyle: 'bg-[#e8f0fe] text-[#174ea6] border border-[#d2e3fc]',
    barColor: 'bg-[#1a73e8]', // Google Blue
    cardBorder: 'border-[#1a73e8]',
  },
  Health: {
    label: 'Health & Fitness',
    icon: Activity,
    iconBg: 'bg-[#e6f4ea]',
    iconColor: 'text-[#188038]',
    badgeStyle: 'bg-[#e6f4ea] text-[#137333] border border-[#ceead6]',
    barColor: 'bg-[#34a853]', // Google Green
    cardBorder: 'border-[#34a853]',
  },
  Utilities: {
    label: 'Utilities',
    icon: Zap,
    iconBg: 'bg-[#fef7e0]',
    iconColor: 'text-[#e37400]',
    badgeStyle: 'bg-[#fef7e0] text-[#b06000] border border-[#feefc3]',
    barColor: 'bg-[#fbbc04]', // Google Yellow
    cardBorder: 'border-[#fbbc04]',
  },
  Other: {
    label: 'Other',
    icon: Layers,
    iconBg: 'bg-[#f1f3f4]',
    iconColor: 'text-[#5f6368]',
    badgeStyle: 'bg-[#f1f3f4] text-[#3c4043] border border-[#dadce0]',
    barColor: 'bg-[#5f6368]', // Google Gray
    cardBorder: 'border-[#80868b]',
  },
};

const PRESETS: Array<{
  name: string;
  category: Category;
  price: number;
  cycle: BillingCycle;
}> = [
    { name: 'Google One', category: 'Software', price: 9.99, cycle: 'Monthly' },
    { name: 'YouTube Prem.', category: 'Streaming', price: 13.99, cycle: 'Monthly' },
    { name: 'Spotify', category: 'Streaming', price: 11.99, cycle: 'Monthly' },
    { name: 'Netflix', category: 'Streaming', price: 15.49, cycle: 'Monthly' },
    { name: 'Fitbit Premium', category: 'Health', price: 79.99, cycle: 'Yearly' },
    { name: 'Fiber Internet', category: 'Utilities', price: 70.0, cycle: 'Monthly' },
    { name: 'GitHub Pro', category: 'Software', price: 4.0, cycle: 'Monthly' },
    { name: 'Google Workspace', category: 'Software', price: 14.4, cycle: 'Monthly' },
  ];

const CURRENCY_OPTIONS: Array<{ code: Currency; label: string; desc: string; short: string }> = [
  { code: '$', label: '$ USD', desc: 'US Dollar', short: 'USD' },
  { code: '€', label: '€ EUR', desc: 'Euro', short: 'EUR' },
  { code: '£', label: '£ GBP', desc: 'British Pound', short: 'GBP' },
  { code: '₹', label: '₹ INR', desc: 'Indian Rupee', short: 'INR' },
];

function EmptyStateIllustration({ className = 'w-56 sm:w-64 max-w-full h-auto' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" fill="none" viewBox="0 0 800 600" className={className}>
      <path d="M128 305.291C128 351.259 176.624 384.751 198.161 421.895C220.303 460.285 225.723 518.776 263.994 541.037C301.174 562.586 354.127 538.51 400.107 538.51C446.087 538.51 499.028 562.586 536.208 541.037C574.479 518.895 579.899 460.285 602.041 421.895C623.578 384.715 672.202 351.425 672.202 305.291C672.202 259.157 623.459 225.832 602.041 188.676C579.899 150.286 574.479 91.6996 536.208 69.534C499.028 47.9969 446.075 72.0601 400.107 72.0601C354.139 72.0601 301.174 47.9969 263.994 69.534C225.605 91.6996 220.351 150.286 198.161 188.676C176.624 225.974 128 259.312 128 305.291Z" fill="black" opacity="0.07" />
      <path d="M309.876 138.664L259.781 120.436C258.37 119.922 256.871 119.691 255.371 119.757C253.871 119.823 252.399 120.184 251.038 120.82C249.678 121.455 248.456 122.353 247.443 123.461C246.43 124.57 245.645 125.867 245.134 127.279L226.894 177.374C226.38 178.784 226.149 180.281 226.214 181.781C226.279 183.281 226.639 184.753 227.274 186.113C227.908 187.473 228.804 188.695 229.911 189.709C231.018 190.722 232.314 191.508 233.725 192.02L283.808 210.296C286.656 211.331 289.799 211.193 292.546 209.912C295.292 208.631 297.417 206.312 298.455 203.465L316.695 153.37C317.217 151.957 317.454 150.454 317.394 148.949C317.333 147.444 316.976 145.966 316.342 144.599C315.709 143.233 314.811 142.005 313.701 140.986C312.592 139.968 311.291 139.178 309.876 138.664ZM289.821 171.42C289.584 172.403 288.97 173.253 288.111 173.785C287.251 174.318 286.217 174.491 285.231 174.266L284.804 174.136L264.809 166.854L270.027 178.05C270.422 178.888 270.496 179.841 270.236 180.73C269.976 181.619 269.4 182.383 268.616 182.876L268.189 183.114C267.349 183.5 266.397 183.567 265.511 183.303C264.625 183.039 263.866 182.462 263.374 181.679L263.137 181.264L254.029 161.743C253.951 161.569 253.884 161.391 253.827 161.209L253.72 160.723L253.661 160.248V159.821L253.72 159.383V159.157L253.827 158.825L253.934 158.564L254.147 158.137L254.408 157.781L254.705 157.438L255.025 157.153L255.381 156.904L255.796 156.679L275.317 147.57C276.197 147.144 277.208 147.072 278.139 147.371C279.07 147.669 279.851 148.315 280.319 149.174C280.788 150.032 280.907 151.038 280.654 151.983C280.4 152.928 279.793 153.738 278.958 154.247L278.531 154.473L267.335 159.691L287.331 166.973C288.221 167.277 288.967 167.899 289.426 168.72C289.886 169.541 290.027 170.502 289.821 171.42Z" fill="#454C5E" />
      <path d="M555.111 152.077C554.482 151.899 553.925 151.721 553.273 151.531L551.529 150.974L550.675 150.701L549.051 150.12L547.509 149.539C534.191 144.261 530.229 137.086 532.839 123.009L533.159 121.396L533.538 119.712L533.752 118.846L534.214 117.067L534.463 116.154L534.724 115.217C534.902 114.601 535.092 114.031 535.27 113.391L535.827 111.636L536.112 110.794L536.681 109.169L537.274 107.627C542.54 94.3087 549.715 90.3476 563.792 92.9567L565.417 93.2769L567.101 93.6565L567.967 93.8699L569.746 94.3325L571.584 94.8424L573.41 95.388L575.166 95.9454L576.008 96.23L577.632 96.7993L579.186 97.3804C592.492 102.658 596.465 109.833 593.844 123.91L593.524 125.523L593.145 127.207C593.074 127.492 593.014 127.788 592.931 128.085L592.481 129.852L591.959 131.702L591.413 133.528L590.868 135.284L590.583 136.126L590.002 137.75L589.421 139.304C584.143 152.611 576.968 156.584 562.891 153.963L561.278 153.642L559.594 153.263L558.728 153.049L556.949 152.587L556.036 152.338L555.111 152.077ZM566.852 135.96C567.212 136.634 567.819 137.144 568.545 137.384C569.272 137.623 570.063 137.574 570.754 137.246C571.445 136.918 571.983 136.337 572.257 135.622C572.531 134.908 572.519 134.116 572.224 133.41L572.058 133.078L567.397 124.622L575.842 119.949C576.478 119.599 576.964 119.028 577.208 118.345C577.453 117.661 577.439 116.911 577.17 116.237L577.004 115.905C576.653 115.269 576.083 114.783 575.399 114.538C574.716 114.294 573.966 114.307 573.292 114.577L572.96 114.743L561.906 120.851C561.272 121.203 560.788 121.773 560.543 122.456C560.299 123.139 560.311 123.888 560.578 124.563L560.732 124.907L566.852 135.96ZM555.407 132.663C555.768 133.337 556.374 133.847 557.101 134.087C557.827 134.327 558.618 134.277 559.309 133.949C560 133.621 560.539 133.04 560.812 132.325C561.086 131.611 561.075 130.819 560.78 130.113L560.614 129.781L555.977 121.349L564.397 116.605C565.028 116.253 565.51 115.683 565.752 115.003C565.994 114.322 565.981 113.576 565.713 112.905L565.559 112.561C565.207 111.926 564.636 111.442 563.953 111.198C563.27 110.953 562.522 110.966 561.847 111.232L561.515 111.398L550.45 117.506C549.818 117.86 549.336 118.432 549.094 119.115C548.852 119.797 548.866 120.545 549.134 121.218L549.288 121.562L555.407 132.663Z" fill="#A6A9B3" />
      <path d="M304.446 212.667C303.985 211.245 303.257 209.925 302.299 208.777C299.263 204.318 294.519 202.397 290.44 204.211C285.257 206.583 283.063 213.984 285.696 221.1C285.949 221.865 286.3 222.594 286.739 223.27C289.681 228.844 295.136 231.643 299.654 229.555C304.707 227.207 306.924 219.617 304.446 212.667Z" fill="#e2c6a7" />
      <path d="M304.446 212.667C303.985 211.245 303.257 209.925 302.299 208.777C300.39 210.402 298.919 211.73 297.876 212.62C294.958 215.122 293.831 216.047 292.136 217.708C290.772 219.036 289.764 220.174 289.064 220.933L287.498 222.546L286.645 223.104C289.586 228.666 295.029 231.477 299.536 229.389C304.707 227.207 306.924 219.617 304.446 212.667Z" fill="black" opacity="0.1" />
      <path d="M539.838 158.647C539.766 157.154 539.98 155.661 540.466 154.247C541.723 149.005 545.483 145.519 549.883 145.791C555.563 146.123 560.248 152.302 560.343 159.881C560.374 160.676 560.306 161.473 560.141 162.252C559.37 168.491 555.267 173.045 550.298 172.701C544.759 172.345 540.004 166.024 539.838 158.647Z" fill="#e2c6a7" />
      <path d="M539.838 158.647C539.766 157.154 539.98 155.661 540.466 154.247C542.838 155.089 544.676 155.813 545.969 156.263C549.586 157.58 550.974 158.03 553.144 158.979C554.887 159.75 556.251 160.438 557.165 160.912L559.193 161.873L560.189 162.086C559.418 168.324 555.326 172.879 550.369 172.535C544.759 172.345 540.004 166.024 539.838 158.647Z" fill="black" opacity="0.1" />
      <path d="M534.263 158.019C526.829 169.038 517.986 179.037 507.958 187.762C501.635 193.571 494.635 198.596 487.109 202.729C478.644 207.256 469.556 210.505 460.14 212.371L387.678 216.226C382.638 215.289 374.301 214.423 366.331 217.411C364.144 218.209 362.07 219.289 360.164 220.625C358.48 221.811 355.42 224.183 349.004 235.165C337.144 255.22 335.081 267.696 330.598 267.791C326.957 267.862 321.525 257.651 314.208 209.952L276.969 232.295C280.742 253.003 289.479 272.487 302.431 289.079L304.032 291.095C312.429 301.65 319.711 310.071 329.946 310.533C332.258 310.635 334.566 310.23 336.706 309.347C349.751 304.129 360.425 282.924 371.265 261.909L372.273 259.904C374.099 272.784 375.878 285.664 377.609 298.543C379.626 312.371 381.476 326.223 383.48 339.886C383.48 339.886 383.48 339.957 383.48 339.992L454.448 336.221C455.136 322.203 455.634 308.197 456.345 294.357C456.713 286.387 457.104 278.583 457.46 270.637L458.445 249.124C480.1 248.851 508.255 235.984 525.439 224.871C543.295 213.588 558.097 198.082 568.537 179.722C571.4 174.504 573.861 169.076 575.902 163.486C561.787 165.806 547.301 163.904 534.263 158.019Z" fill="#f76707" />
      <path d="M225.844 521.527C225.844 524.611 303.014 527.196 398.164 527.196C493.314 527.196 570.496 524.611 570.496 521.527C570.496 518.444 493.314 515.989 398.164 515.989C303.014 515.989 225.844 518.562 225.844 521.527Z" fill="black" opacity="0.3" />
      <path d="M429.957 520.116L456.926 519.642C456.926 519.642 458.539 512.787 454.649 510.023C450.759 507.26 434.997 514.068 429.957 520.116Z" fill="#454C5E" />
      <path d="M368.266 519.831L395.223 519.049C395.223 519.049 396.764 512.17 392.851 509.454C388.937 506.738 373.235 513.724 368.266 519.831Z" fill="#454C5E" />
      <path d="M454.48 336.233L453.899 496.516L442.751 497.346C433.991 457.276 425.234 417.198 416.482 377.113L392.502 498.816L381.828 500.204C382.366 446.78 382.907 393.345 383.453 339.898L405.986 338.712L454.48 336.233Z" fill="#DADBE0" />
      <path d="M416.482 377.113L392.502 498.816L381.828 500.204C382.366 446.78 382.907 393.345 383.453 339.897L405.986 338.711L416.482 377.113Z" fill="black" opacity="0.1" />
      <path d="M384.997 51.4361L383.811 51.1278L382.625 50.8668L382.044 50.7483L380.917 50.5348L379.838 50.3569C370.469 48.9219 365.796 51.7089 362.606 60.6392L362.25 61.671L361.906 62.762L361.728 63.3313L361.396 64.5173L361.242 65.1221L361.076 65.7507C360.981 66.1658 360.874 66.569 360.779 66.9366L360.518 68.1226L360.4 68.7037L360.186 69.8304L359.997 70.9096C358.573 80.2787 361.36 84.9514 370.291 88.1416L371.322 88.4974L372.414 88.8413L372.983 89.0192L374.169 89.3513L375.355 89.6715L376.541 89.968L377.727 90.2289L378.308 90.3475L379.494 90.561L380.573 90.7507C389.942 92.1739 394.615 89.3869 397.805 80.4566L398.161 79.4248L398.505 78.3337C398.56 78.1598 398.619 77.97 398.683 77.7645L399.015 76.5785L399.323 75.3925L399.631 74.2066L399.892 73.0206L400.011 72.4395L400.224 71.2535L400.402 70.1743C401.802 60.8645 399.015 56.1207 390.084 52.9541L389.053 52.5984L387.961 52.2544L387.392 52.0765L386.206 51.7563L385.601 51.5903L384.997 51.4361ZM386.384 64.5766C386.815 64.3071 387.334 64.2149 387.831 64.3193C388.329 64.4236 388.767 64.7164 389.054 65.1363C389.34 65.5562 389.453 66.0707 389.369 66.5721C389.285 67.0735 389.01 67.5228 388.602 67.8261L388.4 67.9566L382.826 71.2417L386.1 76.7327C386.346 77.1441 386.434 77.6315 386.347 78.1032C386.259 78.5749 386.003 78.9985 385.625 79.2943L385.424 79.4367C385.009 79.6828 384.519 79.7692 384.045 79.6796C383.571 79.5901 383.146 79.3308 382.85 78.9504L382.72 78.7488L378.474 71.5382C378.228 71.1253 378.142 70.6371 378.232 70.1653C378.322 69.6935 378.58 69.2707 378.96 68.9765L379.162 68.8342L386.384 64.5766ZM378.735 62.6434C379.166 62.374 379.684 62.2818 380.182 62.3861C380.68 62.4905 381.118 62.7832 381.404 63.2032C381.691 63.6231 381.804 64.1376 381.72 64.639C381.635 65.1403 381.36 65.5897 380.952 65.893L380.751 66.0234L375.26 69.3086L378.533 74.7995C378.78 75.211 378.868 75.6984 378.78 76.1701C378.693 76.6418 378.436 77.0653 378.059 77.3612L377.857 77.5035C377.443 77.7522 376.952 77.8401 376.478 77.7505C376.003 77.6608 375.578 77.3999 375.284 77.0173L375.153 76.8157L370.86 69.6288C370.615 69.2159 370.529 68.7277 370.618 68.2559C370.708 67.7841 370.967 67.3613 371.346 67.0671L371.548 66.9248L378.735 62.6434Z" fill="#f76707" />
      <path d="M232.791 347.618L230.42 348.65L228.202 349.682L227.134 350.192L225.071 351.235L223.126 352.267C206.428 361.506 202.395 371.657 208.242 389.826L208.954 391.914L209.736 394.084C209.867 394.44 210.009 394.819 210.163 395.187L211.065 397.464L211.551 398.65L212.061 399.836C212.405 400.63 212.749 401.401 213.093 402.208L214.124 404.426L214.646 405.493L215.678 407.556L216.722 409.501C225.948 426.2 236.1 430.232 254.269 424.385L256.356 423.674L258.527 422.891C258.883 422.76 259.262 422.618 259.63 422.464L261.907 421.563L264.279 420.566L266.651 419.535L268.868 418.503L269.936 417.981L271.999 416.949L273.944 415.906C290.643 406.679 294.675 396.527 288.828 378.358L288.128 376.271L287.334 374.1C287.203 373.745 287.061 373.365 286.907 372.998L286.006 370.72L285.009 368.349L283.978 365.977L282.946 363.759L282.436 362.68L281.392 360.628L280.36 358.683C271.122 341.985 260.97 337.952 242.801 343.799L240.714 344.499L238.543 345.293L237.44 345.72L235.163 346.622L233.977 347.108L232.791 347.618ZM251.067 366.937C251.451 366.015 252.169 365.271 253.077 364.854C253.985 364.437 255.016 364.377 255.966 364.687C256.916 364.997 257.715 365.653 258.202 366.525C258.69 367.397 258.831 368.421 258.598 369.392L258.444 369.867L253.7 381.821L265.666 386.565C266.563 386.921 267.299 387.593 267.735 388.453C268.172 389.313 268.28 390.304 268.038 391.238L267.884 391.712C267.525 392.61 266.852 393.346 265.989 393.782C265.127 394.219 264.135 394.326 263.2 394.084L262.725 393.93L247.07 387.727C246.174 387.366 245.44 386.693 245.004 385.831C244.568 384.969 244.459 383.978 244.699 383.043L244.853 382.568L251.067 366.937ZM236.492 373.235C236.876 372.312 237.593 371.569 238.501 371.152C239.409 370.735 240.441 370.675 241.391 370.985C242.341 371.294 243.139 371.95 243.627 372.822C244.115 373.694 244.256 374.718 244.023 375.69L243.868 376.164L239.124 388.13L251.091 392.874C251.987 393.231 252.723 393.902 253.16 394.762C253.597 395.623 253.704 396.613 253.463 397.547L253.309 398.021C252.95 398.919 252.276 399.655 251.414 400.091C250.552 400.528 249.56 400.635 248.624 400.393L248.15 400.239L232.495 394.036C231.597 393.678 230.861 393.004 230.425 392.142C229.988 391.28 229.881 390.288 230.123 389.352L230.277 388.878L236.492 373.235Z" fill="#A6A9B3" />
      <path d="M593.752 281.987C597.129 282.858 600.023 285.032 601.802 288.033C603.58 291.034 604.097 294.616 603.24 297.997L588.166 357.615C587.297 360.992 585.125 363.886 582.127 365.664C579.128 367.443 575.547 367.96 572.167 367.103L512.549 352.03C509.162 351.174 506.253 349.007 504.463 346.007C502.673 343.007 502.147 339.418 503.002 336.031L518.064 276.413C518.923 273.025 521.091 270.116 524.093 268.326C527.095 266.536 530.685 266.011 534.074 266.866L593.752 281.987ZM561.257 297.76C560.961 297.264 560.571 296.832 560.108 296.487C559.645 296.142 559.119 295.892 558.559 295.751C558 295.61 557.418 295.581 556.847 295.665C556.276 295.749 555.727 295.945 555.232 296.242L533.885 308.967L533.422 309.276L533.054 309.596L532.734 309.964L532.426 310.379L532.177 310.829L531.963 311.351L531.868 311.659L531.797 312.051V312.3V312.834V313.32L531.904 313.854L532.094 314.411C532.177 314.61 532.272 314.804 532.378 314.992L545.116 336.339L545.424 336.79C546.082 337.635 547.027 338.21 548.08 338.407C549.133 338.603 550.221 338.408 551.14 337.857L551.591 337.549C552.432 336.888 553.003 335.943 553.2 334.892C553.396 333.84 553.204 332.753 552.658 331.833L545.305 319.594L569.084 325.606L569.594 325.701C570.711 325.861 571.846 325.585 572.765 324.93C573.683 324.275 574.314 323.291 574.526 322.183C574.738 321.075 574.515 319.927 573.904 318.979C573.292 318.031 572.339 317.355 571.242 317.091L547.499 311.102L559.727 303.808L560.189 303.488C561.037 302.829 561.614 301.882 561.811 300.827C562.008 299.771 561.81 298.68 561.257 297.76Z" fill="#f76707" />
      <path d="M373.766 156.998C375.141 160.556 377.324 165.846 379.945 172.143C380.597 173.59 381.13 174.74 381.308 175.191C384.583 182.037 388.677 188.461 393.5 194.32C394.556 195.506 395.421 196.515 396.477 197.653C399.252 200.404 410.495 200.914 421.868 198.388C425.811 197.545 429.641 196.24 433.277 194.498C444.722 189.245 447.141 177.693 443.287 171.313C442.39 169.757 441.036 168.514 439.409 167.755C436.35 166.019 433.603 163.782 431.285 161.137C428.072 157.699 425.178 153.975 422.639 150.013C421.758 148.828 420.946 147.592 420.208 146.313L405.217 140.205L377.442 149.693C379.328 154.247 379.209 157.995 377.857 158.777C376.505 159.56 374.276 157.485 373.766 156.998Z" fill="#e2c6a7" />
      <path d="M373.766 156.999C375.141 160.556 377.324 165.846 379.945 172.143C380.597 173.59 381.13 174.74 381.308 175.191C384.583 182.038 388.677 188.461 393.5 194.321C395.087 193.105 396.448 191.62 397.52 189.933C398.644 188.043 399.416 185.966 399.797 183.801C400.106 181.484 400.07 179.134 399.691 176.828C399.513 175.369 399.145 173.815 398.849 172.416C410.7 172.366 422.189 168.326 431.463 160.948C428.25 157.509 425.356 153.786 422.817 149.823C421.932 148.649 421.12 147.421 420.386 146.147L405.383 140.063L377.608 149.551C379.506 154.105 379.363 157.852 378.011 158.623C376.659 159.394 374.311 157.544 373.801 157.07" fill="black" opacity="0.1" />
      <path d="M372.354 164.173C374.454 169.916 378.649 174.653 384.095 177.432C385.281 177.871 386.254 178.381 387.25 178.867C389.954 180.566 392.195 182.909 393.773 185.687C394.577 183.731 394.723 181.566 394.188 179.52C393.31 176.46 390.001 171.218 389.752 170.471L389.598 170.02C389.44 169.57 389.238 169.137 388.993 168.727C388.333 167.279 387.817 165.77 387.451 164.221V164.043C396.002 165.988 419.638 169.486 429.565 154.733C431.086 152.406 432.317 149.9 433.229 147.273C433.36 147.043 433.444 146.789 433.479 146.526C433.705 145.875 433.867 145.204 433.965 144.522L434.06 144.32C434.441 142.534 434.497 140.695 434.226 138.889V138.236C434.118 137.446 433.857 136.684 433.455 135.995C432.113 133.232 429.824 131.044 427.003 129.828C421.749 127.243 415.286 126.946 411.716 126.816C398.232 126.068 380.015 131.109 373.433 145.317C371.879 148.982 371.169 152.95 371.358 156.927C371.42 159.409 371.819 161.87 372.544 164.245" fill="#454C5E" />
      <path d="M387.403 164.043C395.954 165.988 419.59 169.487 429.516 154.733C431.038 152.406 432.269 149.901 433.181 147.274C433.311 147.043 433.396 146.789 433.43 146.527C433.656 145.876 433.819 145.204 433.916 144.522C433.907 144.505 433.901 144.485 433.9 144.465C433.899 144.445 433.903 144.425 433.911 144.407C433.919 144.389 433.931 144.372 433.947 144.359C433.962 144.347 433.98 144.337 433.999 144.333C434.381 142.547 434.437 140.707 434.165 138.901C432.004 143.049 429.202 146.832 425.864 150.108C409.367 166.107 384.723 161.612 380.797 160.948H380.441C382.647 162.039 385.019 163.083 387.379 164.091" fill="black" opacity="0.5" />
      <path d="M422.934 212.442C419.189 216.762 414.189 219.806 408.631 221.147L407.849 221.337L393.617 215.751L422.934 212.442Z" fill="#e2c6a7" />
      <path d="M422.934 212.442C419.189 216.762 414.189 219.806 408.631 221.147L407.849 221.337L393.617 215.751L422.934 212.442Z" fill="black" opacity="0.1" />
      <path d="M407.839 221.337L389.931 209.916L386.184 214.245L398.838 231.192L407.839 221.337Z" fill="#DADBE0" />
      <path d="M408.633 221.313L434.048 203.429L440.215 208.671L423.694 232.734L408.633 221.313Z" fill="#DADBE0" />
      <path d="M407.839 221.337L389.931 209.916L386.184 214.245L398.838 231.192L407.839 221.337Z" fill="black" opacity="0.11" />
      <path d="M418.322 236.149C414.942 259.193 411.562 282.236 408.336 305.291C405.691 282.402 402.892 259.525 400.105 236.802C402.833 231.56 405.419 226.507 408.229 221.277L409.024 221.396C411.929 226.401 415.037 231.275 418.322 236.149Z" fill="#DADBE0" />
      <path d="M408.006 221.349L408.184 305.35C405.527 282.449 402.74 259.572 399.941 236.849C402.669 231.643 405.255 226.401 408.006 221.349Z" fill="black" opacity="0.11" />
      <path d="M458.48 249.124L457.543 270.637C457.187 278.595 456.796 286.399 456.428 294.357C455.752 308.197 455.242 322.203 454.53 336.221L383.562 339.992C383.562 339.992 383.562 339.933 383.562 339.886C444.343 317.483 458.242 250.215 458.48 249.124Z" fill="black" opacity="0.1" />
      <path d="M575.84 119.949L567.396 124.622L572.069 133.078L572.223 133.41C572.518 134.116 572.53 134.908 572.256 135.622C571.982 136.337 571.444 136.918 570.753 137.246C570.061 137.574 569.271 137.624 568.544 137.384C567.818 137.145 567.211 136.635 566.851 135.96L560.719 124.907L560.553 124.563C560.286 123.888 560.274 123.14 560.518 122.457C560.763 121.774 561.247 121.203 561.881 120.851L572.935 114.743L573.279 114.577C573.951 114.308 574.699 114.295 575.38 114.54C576.062 114.784 576.631 115.27 576.979 115.905L577.145 116.237C577.416 116.909 577.433 117.656 577.193 118.34C576.953 119.023 576.472 119.595 575.84 119.949Z" fill="white" />
      <path d="M564.397 116.605L555.976 121.348L560.637 129.793L560.803 130.125C561.098 130.83 561.11 131.623 560.836 132.337C560.562 133.051 560.024 133.633 559.333 133.961C558.641 134.289 557.851 134.338 557.124 134.099C556.398 133.859 555.791 133.349 555.431 132.674L549.311 121.621L549.157 121.277C548.888 120.605 548.875 119.857 549.12 119.175C549.364 118.494 549.85 117.925 550.485 117.577L561.538 111.458L561.87 111.292C562.545 111.025 563.294 111.012 563.977 111.257C564.66 111.501 565.23 111.986 565.583 112.62L565.749 112.964C565.999 113.632 566 114.368 565.752 115.036C565.503 115.705 565.022 116.262 564.397 116.605Z" fill="white" />
      <path d="M289.823 171.42C289.586 172.403 288.972 173.252 288.113 173.785C287.254 174.318 286.219 174.491 285.234 174.266L284.807 174.136L264.811 166.854L270.03 178.049C270.427 178.887 270.502 179.841 270.242 180.731C269.982 181.621 269.404 182.384 268.618 182.876L268.203 183.113C267.362 183.5 266.408 183.568 265.52 183.304C264.632 183.04 263.87 182.462 263.376 181.678L263.139 181.263L254.043 161.742C253.957 161.571 253.885 161.392 253.829 161.209L253.723 160.722V160.248V159.821L253.782 159.382V159.157L253.889 158.825L253.995 158.564L254.221 158.137L254.47 157.781L254.778 157.437L255.087 157.153L255.442 156.904L255.857 156.678L275.378 147.57C276.258 147.144 277.269 147.072 278.2 147.371C279.132 147.669 279.913 148.315 280.381 149.173C280.849 150.032 280.969 151.038 280.715 151.983C280.462 152.927 279.854 153.738 279.019 154.247L278.604 154.472L267.397 159.691L287.392 166.972C288.271 167.288 289.004 167.915 289.452 168.735C289.9 169.554 290.032 170.509 289.823 171.42Z" fill="white" />
      <path d="M388.58 67.8258L388.366 67.9562L382.828 71.2413L386.101 76.7323C386.348 77.1441 386.436 77.6312 386.348 78.1028C386.261 78.5745 386.004 78.9981 385.627 79.294L385.425 79.4363C385.014 79.6829 384.526 79.7708 384.055 79.6834C383.583 79.5961 383.159 79.3395 382.864 78.9619L382.721 78.7485L378.475 71.5378C378.23 71.125 378.144 70.6367 378.234 70.1649C378.323 69.6931 378.582 69.2703 378.962 68.9761L379.163 68.8338L386.386 64.5762C386.816 64.3409 387.319 64.2737 387.796 64.3877C388.273 64.5018 388.691 64.7889 388.969 65.1935C389.247 65.5981 389.364 66.0914 389.299 66.5777C389.233 67.064 388.99 67.5087 388.615 67.8258H388.58Z" fill="white" />
      <path d="M380.928 65.8926L380.714 66.0231L375.223 69.3082L378.496 74.7992C378.743 75.2107 378.831 75.698 378.743 76.1697C378.656 76.6414 378.4 77.065 378.022 77.3609L377.82 77.5032C377.409 77.7498 376.921 77.8377 376.45 77.7503C375.978 77.663 375.555 77.4064 375.259 77.0288L375.116 76.8153L370.823 69.6284C370.578 69.2156 370.492 68.7273 370.581 68.2555C370.708 67.7838 370.93 67.361 371.309 67.0668L371.511 66.9244L378.698 62.6431C379.128 62.4078 379.631 62.3406 380.108 62.4546C380.586 62.5687 381.003 62.8558 381.281 63.2604C381.559 63.665 381.676 64.1583 381.611 64.6446C381.546 65.1309 381.302 65.5756 380.928 65.8926Z" fill="white" />
      <path d="M253.474 397.547L253.32 398.022C252.964 398.918 252.292 399.654 251.432 400.091C250.572 400.527 249.581 400.635 248.647 400.394L248.173 400.239L232.506 394.037C231.609 393.678 230.873 393.004 230.436 392.142C230 391.28 229.892 390.288 230.135 389.352L230.289 388.878L236.491 373.223C236.875 372.301 237.593 371.557 238.501 371.14C239.409 370.723 240.44 370.663 241.39 370.973C242.34 371.283 243.139 371.939 243.626 372.811C244.114 373.683 244.255 374.707 244.022 375.678L243.868 376.152L239.124 388.119L251.09 392.863C251.992 393.217 252.732 393.889 253.171 394.753C253.611 395.616 253.718 396.61 253.474 397.547Z" fill="white" />
      <path d="M268.05 391.249L267.896 391.724C267.54 392.62 266.868 393.356 266.008 393.793C265.148 394.229 264.157 394.337 263.223 394.096L262.749 393.941L247.082 387.739C246.186 387.378 245.452 386.704 245.016 385.843C244.579 384.981 244.471 383.99 244.71 383.054L244.865 382.58L251.067 366.925C251.451 366.003 252.169 365.259 253.077 364.842C253.985 364.425 255.016 364.365 255.966 364.675C256.916 364.985 257.715 365.641 258.202 366.513C258.69 367.385 258.831 368.409 258.598 369.38L258.444 369.855L253.7 381.821L265.666 386.565C266.568 386.919 267.308 387.592 267.747 388.455C268.186 389.318 268.294 390.312 268.05 391.249Z" fill="white" />
      <path d="M574.563 321.906C574.413 323.062 573.81 324.11 572.887 324.822C571.965 325.533 570.797 325.85 569.642 325.702L569.143 325.607L545.306 319.594L552.599 331.821C553.15 332.74 553.345 333.829 553.148 334.882C552.952 335.934 552.377 336.879 551.532 337.537L551.081 337.846C550.162 338.394 549.074 338.588 548.022 338.391C546.969 338.195 546.025 337.621 545.365 336.778L545.057 336.328L532.331 314.98C532.216 314.796 532.117 314.601 532.035 314.399L531.857 313.842L531.738 313.308V312.822V312.288V312.039L531.821 311.648L531.904 311.34L532.118 310.818L532.367 310.367L532.675 309.952L532.995 309.584L533.375 309.264L533.826 308.956L555.173 296.23C556.131 295.655 557.273 295.466 558.365 295.704C559.458 295.941 560.418 296.587 561.051 297.508C561.684 298.43 561.941 299.559 561.77 300.663C561.598 301.768 561.012 302.766 560.13 303.453L559.68 303.773L547.512 311.102L571.231 317.115C572.278 317.364 573.198 317.99 573.812 318.874C574.427 319.758 574.695 320.838 574.563 321.906Z" fill="white" />
    </svg>
  );
}

interface SubscriptionCardProps {
  sub: Subscription;
  preferredCurrency: Currency;
  onEdit: (sub: Subscription) => void;
  onDelete: (sub: Subscription) => void;
  onMarkRenewed: (sub: Subscription) => void;
}

function SubscriptionCard({
  sub,
  preferredCurrency,
  onEdit,
  onDelete,
  onMarkRenewed,
}: SubscriptionCardProps) {
  const daysLeft = getDaysUntil(sub.renewalDate);
  const config = CATEGORY_CONFIG[sub.category];
  const CategoryIcon = config.icon;

  // Clean Google countdown badge with shortened day count ("X days")
  let badgeColor = 'bg-[#f1f3f4] text-[#5f6368] border border-[#dadce0]';
  let badgeText = `${daysLeft} days`;

  if (daysLeft < 0) {
    badgeColor = 'bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] font-semibold';
    badgeText = daysLeft === -1 ? 'Overdue (1d)' : `Overdue (${Math.abs(daysLeft)}d)`;
  } else if (daysLeft === 0) {
    badgeColor = 'bg-[#fce8e6] text-[#c5221f] border border-[#fad2cf] font-bold';
    badgeText = 'Due today!';
  } else if (daysLeft === 1) {
    badgeColor = 'bg-[#fef7e0] text-[#b06000] border border-[#feefc3] font-medium';
    badgeText = 'Due tomorrow';
  } else if (daysLeft <= 7) {
    badgeColor = 'bg-[#e8f0fe] text-[#174ea6] border border-[#d2e3fc] font-medium';
    badgeText = `${daysLeft} days`;
  }

  return (
    <div
      className={`bg-white border-2 ${config.cardBorder} rounded-2xl p-3.5 transition-all shadow-[0_1px_2px_0_rgba(60,64,67,0.08)] hover:shadow-md`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Category Icon + Service Name + Renew Date & Shortened Days Badge */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg} ${config.iconColor}`}
          >
            <CategoryIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-[#202124] tracking-tight truncate leading-tight">
              {sub.name}
            </h4>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-[11px] font-medium text-[#5f6368]">
                {formatDisplayDate(sub.renewalDate)}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>
                {badgeText}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Cost & Frequency Label (/m or /yr) on Top, Edit & Delete Buttons Directly Below */}
        <div className="flex flex-col items-end justify-center shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-[#202124]">
              {sub.currency || preferredCurrency}
              {sub.price.toFixed(2)}
            </span>
            <span className="text-[10px] font-medium text-[#5f6368] bg-[#f1f3f4] border border-[#dadce0] px-1.5 py-0.5 rounded-full">
              {sub.billingCycle === 'Monthly' ? '/m' : '/yr'}
            </span>
          </div>

          {/* Action Buttons: Edit and Delete neatly side-by-side directly under price label */}
          <div className="flex items-center gap-1 mt-1.5">
            {daysLeft <= 2 && (
              <button
                type="button"
                onClick={() => onMarkRenewed(sub)}
                title="Mark as paid / Renew 1 cycle"
                className="flex items-center gap-1 py-1 px-2 text-[10px] font-medium text-[#188038] bg-[#e6f4ea] hover:bg-[#ceead6] border border-[#ceead6] rounded-full transition active:scale-95 shadow-xs"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Renew</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onEdit(sub)}
              title="Edit subscription"
              aria-label="Edit subscription"
              className="p-1.5 text-[#1a73e8] bg-[#e8f0fe] hover:bg-[#d2e3fc] border border-[#d2e3fc] rounded-full transition active:scale-95 shadow-xs flex items-center justify-center"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(sub)}
              title="Delete subscription"
              aria-label="Delete subscription"
              className="p-1.5 text-[#80868b] hover:text-[#d93025] hover:bg-[#fce8e6] border border-transparent hover:border-[#fad2cf] rounded-full transition active:scale-95 flex items-center justify-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // Main Subscriptions State
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
      return [];
    } catch {
      return [];
    }
  });

  // User Profile State
  const [userName, setUserName] = useState<string>(() => {
    try {
      return localStorage.getItem(USER_NAME_KEY) || 'Alex Miller';
    } catch {
      return 'Alex Miller';
    }
  });

  // User Profile Avatar State (defaults to 'initials')
  const [userAvatar, setUserAvatar] = useState<string>(() => {
    try {
      return localStorage.getItem(USER_AVATAR_KEY) || 'initials';
    } catch {
      return 'initials';
    }
  });

  // Currency State
  const [preferredCurrency, setPreferredCurrency] = useState<Currency>(() => {
    try {
      return (localStorage.getItem(CURRENCY_STORAGE_KEY) as Currency) || '$';
    } catch {
      return '$';
    }
  });

  // Search, Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [sortBy, setSortBy] = useState<'renewal' | 'price' | 'name'>('renewal');

  // Subscription Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);


  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempUserName, setTempUserName] = useState(userName);
  const [tempUserAvatar, setTempUserAvatar] = useState(userAvatar);
  const [tempCurrency, setTempCurrency] = useState(preferredCurrency);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const hasSettingsChanged =
    tempUserName.trim() !== userName.trim() ||
    tempUserAvatar !== userAvatar ||
    tempCurrency !== preferredCurrency;

  // Auto-focus save button when settings change
  useEffect(() => {
    if (hasSettingsChanged && isSettingsOpen) {
      saveButtonRef.current?.focus();
    }
  }, [hasSettingsChanged, isSettingsOpen]);

  // Handle escape key on desktop to close settings
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen]);

  // Subscription Form State
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCycle, setFormCycle] = useState<BillingCycle>('Monthly');
  const [formDate, setFormDate] = useState(getFutureDate(30));
  const [formCategory, setFormCategory] = useState<Category>('Streaming');
  const [formNotes, setFormNotes] = useState('');
  const [formErrors, setFormErrors] = useState<{ name?: string; price?: string; date?: string }>({});

  // Delete Confirmation State
  const [subToDelete, setSubToDelete] = useState<Subscription | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // First-time Onboarding Modal State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [onboardingName, setOnboardingName] = useState(() => {
    try {
      const hasOnboarded = localStorage.getItem(ONBOARDING_KEY);
      return hasOnboarded ? (localStorage.getItem(USER_NAME_KEY) || '') : '';
    } catch {
      return '';
    }
  });
  const [onboardingAvatar, setOnboardingAvatar] = useState(() => {
    try {
      return localStorage.getItem(USER_AVATAR_KEY) || 'initials';
    } catch {
      return 'initials';
    }
  });
  const [onboardingCurrency, setOnboardingCurrency] = useState<Currency>(() => {
    try {
      return (localStorage.getItem(CURRENCY_STORAGE_KEY) as Currency) || '$';
    } catch {
      return '$';
    }
  });
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  // Trigger onboarding popup after 2 seconds if no cache found
  useEffect(() => {
    try {
      const hasOnboarded = localStorage.getItem(ONBOARDING_KEY) === 'true';
      if (!hasOnboarded) {
        const timer = setTimeout(() => {
          setIsOnboardingOpen(true);
        }, 2000);
        return () => clearTimeout(timer);
      }
    } catch (e) {
      console.warn('Could not read cache:', e);
      const timer = setTimeout(() => {
        setIsOnboardingOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // Persist Subscriptions
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [subscriptions]);

  // Persist Currency
  useEffect(() => {
    try {
      localStorage.setItem(CURRENCY_STORAGE_KEY, preferredCurrency);
    } catch (e) {
      console.error('Failed to save currency preference', e);
    }
  }, [preferredCurrency]);

  // Persist User Name
  useEffect(() => {
    try {
      localStorage.setItem(USER_NAME_KEY, userName);
    } catch (e) {
      console.error('Failed to save user name', e);
    }
  }, [userName]);

  // Persist User Avatar
  useEffect(() => {
    try {
      localStorage.setItem(USER_AVATAR_KEY, userAvatar);
    } catch (e) {
      console.error('Failed to save user avatar', e);
    }
  }, [userAvatar]);

  // Auto-reset category filter if selected category has no active subscriptions
  useEffect(() => {
    if (selectedCategory !== 'All') {
      const exists = subscriptions.some((s) => s.category === selectedCategory);
      if (!exists) {
        setSelectedCategory('All');
      }
    }
  }, [subscriptions, selectedCategory]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  // Overall metrics calculation (for category distribution & export)
  const { totalMonthlySpend, totalAnnualSpend, categoryBreakdown } = useMemo(() => {
    let monthly = 0;
    let annual = 0;
    const catCounts: Record<Category, number> = {
      Streaming: 0,
      Software: 0,
      Health: 0,
      Utilities: 0,
      Other: 0,
    };

    subscriptions.forEach((sub) => {
      const subMonthly = sub.billingCycle === 'Monthly' ? sub.price : sub.price / 12;
      monthly += subMonthly;
      annual += subMonthly * 12;
      catCounts[sub.category] = (catCounts[sub.category] || 0) + subMonthly;
    });

    return {
      totalMonthlySpend: monthly,
      totalAnnualSpend: annual,
      categoryBreakdown: catCounts,
    };
  }, [subscriptions]);

  // Filtered monthly and annualized numbers (updates when user selects a category filter)
  const { monthlySpend, annualSpend } = useMemo(() => {
    const list =
      selectedCategory === 'All'
        ? subscriptions
        : subscriptions.filter((sub) => sub.category === selectedCategory);

    let monthly = 0;
    list.forEach((sub) => {
      const subMonthly = sub.billingCycle === 'Monthly' ? sub.price : sub.price / 12;
      monthly += subMonthly;
    });

    return {
      monthlySpend: monthly,
      annualSpend: monthly * 12,
    };
  }, [subscriptions, selectedCategory]);

  // Filtering & Sorting
  const filteredSubscriptions = useMemo(() => {
    return subscriptions
      .filter((sub) => {
        const matchesSearch =
          sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          sub.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || sub.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'renewal') {
          return getDaysUntil(a.renewalDate) - getDaysUntil(b.renewalDate);
        }
        if (sortBy === 'price') {
          const priceA = a.billingCycle === 'Monthly' ? a.price : a.price / 12;
          const priceB = b.billingCycle === 'Monthly' ? b.price : b.price / 12;
          return priceB - priceA;
        }
        return a.name.localeCompare(b.name);
      });
  }, [subscriptions, searchQuery, selectedCategory, sortBy]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingSub(null);
    setFormName('');
    setFormPrice('');
    setFormCycle('Monthly');
    setFormDate(getFutureDate(30));
    setFormCategory('Streaming');
    setFormNotes('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (sub: Subscription) => {
    setEditingSub(sub);
    setFormName(sub.name);
    setFormPrice(sub.price.toString());
    setFormCycle(sub.billingCycle);
    setFormDate(sub.renewalDate);
    setFormCategory(sub.category);
    setFormNotes(sub.notes || '');
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Settings Modal
  const handleOpenSettings = () => {
    setTempUserName(userName);
    setTempUserAvatar(userAvatar);
    setTempCurrency(preferredCurrency);
    setIsSettingsOpen(true);
  };

  // Save Settings Modal
  const handleSaveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = tempUserName.trim() || 'Alex Miller';
    setUserName(finalName);
    setUserAvatar(tempUserAvatar);
    if (tempCurrency !== preferredCurrency) {
      setPreferredCurrency(tempCurrency);
      setSubscriptions((prev) => prev.map((s) => ({ ...s, currency: tempCurrency })));
    }
    try {
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (e) {
      console.error('Failed to update onboarding key in settings', e);
    }
    setIsSettingsOpen(false);
    showToast(`Settings updated`);
  };

  // Save Onboarding Modal
  const handleSaveOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = onboardingName.trim() || 'Alex Miller';
    setUserName(finalName);
    setUserAvatar(onboardingAvatar);
    setPreferredCurrency(onboardingCurrency);

    try {
      localStorage.setItem(USER_NAME_KEY, finalName);
      localStorage.setItem(USER_AVATAR_KEY, onboardingAvatar);
      localStorage.setItem(CURRENCY_STORAGE_KEY, onboardingCurrency);
      localStorage.setItem(ONBOARDING_KEY, 'true');
    } catch (err) {
      console.error('Failed to save onboarding cache', err);
    }

    setSubscriptions((prev) => prev.map((s) => ({ ...s, currency: onboardingCurrency })));
    setIsOnboardingOpen(false);
    showToast(`Welcome, ${finalName}! Preferences saved.`);
  };

  // Avatar Render Helper
  const renderAvatar = (avatarId: string, name: string, sizeClass = 'w-9 h-9', textClass = 'text-xs') => {
    const selected = AVATAR_OPTIONS.find((a) => a.id === avatarId);
    if (selected && !selected.isInitials && selected.src) {
      return (
        <img
          src={selected.src}
          alt={selected.label}
          className={`${sizeClass} rounded-full object-cover border border-[#dadce0] bg-[#f8fafd] shadow-sm select-none`}
        />
      );
    }
    return (
      <div
        className={`${sizeClass} rounded-full bg-[#1a73e8] text-white flex items-center justify-center font-bold ${textClass} shadow-sm select-none`}
      >
        {getUserInitials(name)}
      </div>
    );
  };

  // Quick Preset Helper
  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setFormName(preset.name);
    setFormCategory(preset.category);
    setFormPrice(preset.price.toString());
    setFormCycle(preset.cycle);
    setFormErrors((prev) => ({ ...prev, name: undefined, price: undefined }));
  };

  // Save Subscription
  const handleSaveSubscription = (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { name?: string; price?: string; date?: string } = {};
    if (!formName.trim()) {
      errors.name = 'Service name is required';
    }
    const numPrice = parseFloat(formPrice);
    if (isNaN(numPrice) || numPrice <= 0) {
      errors.price = 'Enter a valid price greater than 0';
    }
    if (!formDate) {
      errors.date = 'Select a renewal date';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (editingSub) {
      setSubscriptions((prev) =>
        prev.map((item) =>
          item.id === editingSub.id
            ? {
              ...item,
              name: formName.trim(),
              price: parseFloat(numPrice.toFixed(2)),
              currency: preferredCurrency,
              billingCycle: formCycle,
              renewalDate: formDate,
              category: formCategory,
              notes: formNotes.trim(),
            }
            : item
        )
      );
      showToast(`Updated "${formName.trim()}"`);
    } else {
      const newSub: Subscription = {
        id: `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: formName.trim(),
        price: parseFloat(numPrice.toFixed(2)),
        currency: preferredCurrency,
        billingCycle: formCycle,
        renewalDate: formDate,
        category: formCategory,
        notes: formNotes.trim(),
        createdAt: Date.now(),
      };
      setSubscriptions((prev) => [...prev, newSub]);
      showToast(`Added "${formName.trim()}"`);
    }

    setIsModalOpen(false);
  };

  // Delete Action
  const confirmDelete = () => {
    if (!subToDelete) return;
    setSubscriptions((prev) => prev.filter((s) => s.id !== subToDelete.id));
    showToast(`Removed "${subToDelete.name}"`);
    setSubToDelete(null);
  };

  // Quick action: Renew 1 cycle
  const handleMarkAsRenewed = (sub: Subscription) => {
    const [y, m, d] = sub.renewalDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);

    if (sub.billingCycle === 'Monthly') {
      date.setMonth(date.getMonth() + 1);
    } else {
      date.setFullYear(date.getFullYear() + 1);
    }

    const nextDateStr = date.toISOString().split('T')[0];
    setSubscriptions((prev) =>
      prev.map((item) => (item.id === sub.id ? { ...item, renewalDate: nextDateStr } : item))
    );
    showToast(`Renewed for next cycle (${formatDisplayDate(nextDateStr)})`);
  };

  // Export Excel (.xlsx) with Android Download folder support
  const handleExportData = async () => {
    if (subscriptions.length === 0) {
      showToast('No subscriptions to export');
      return;
    }

    try {
      const exportRows = subscriptions.map((sub, index) => {
        const daysLeft = getDaysUntil(sub.renewalDate);
        const monthlyCost = sub.billingCycle === 'Monthly' ? sub.price : Number((sub.price / 12).toFixed(2));
        const annualCost = sub.billingCycle === 'Yearly' ? sub.price : Number((sub.price * 12).toFixed(2));
        return {
          '#': index + 1,
          'Service Name': sub.name,
          'Price': sub.price,
          'Currency': sub.currency || preferredCurrency,
          'Billing Cycle': sub.billingCycle,
          'Category': sub.category,
          'Renewal Date': sub.renewalDate,
          'Days Left': daysLeft,
          'Monthly Cost': monthlyCost,
          'Annual Cost': annualCost,
          'Notes': sub.notes || '',
        };
      });

      const summaryRows = [
        { Metric: 'Total Subscriptions', Value: subscriptions.length },
        { Metric: 'Total Monthly Spend', Value: `${preferredCurrency}${totalMonthlySpend.toFixed(2)}` },
        { Metric: 'Total Annual Spend', Value: `${preferredCurrency}${totalAnnualSpend.toFixed(2)}` },
        { Metric: 'Preferred Currency', Value: preferredCurrency },
        { Metric: 'Exported Date', Value: new Date().toLocaleString() },
        { Metric: '', Value: '' },
        { Metric: 'Category Breakdown', Value: '' },
        ...Object.entries(categoryBreakdown).map(([cat, amount]) => ({
          Metric: cat,
          Value: `${preferredCurrency}${amount.toFixed(2)} /mo`,
        })),
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws['!cols'] = [
        { wch: 5 },  // #
        { wch: 26 }, // Service Name
        { wch: 10 }, // Price
        { wch: 10 }, // Currency
        { wch: 14 }, // Billing Cycle
        { wch: 16 }, // Category
        { wch: 14 }, // Renewal Date
        { wch: 12 }, // Days Left
        { wch: 14 }, // Monthly Cost
        { wch: 14 }, // Annual Cost
        { wch: 30 }, // Notes
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Subscriptions');

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [{ wch: 24 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      const base64Data = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const fileName = `SubTrack_Subscriptions_${new Date().toISOString().split('T')[0]}.xlsx`;

      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();

      if (isNative && platform === 'android') {
        try {
          // 1. Native MediaStore Downloads folder
          await AndroidDownloader.downloadToPublicFolder({
            fileName,
            base64Data,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          });
          showToast('Excel downloaded to Download folder');
          return;
        } catch (nativeErr) {
          console.warn('Native AndroidDownloader failed, trying Filesystem fallback:', nativeErr);
          try {
            // 2. Capacitor Filesystem fallback
            await Filesystem.writeFile({
              path: `Download/${fileName}`,
              data: base64Data,
              directory: Directory.ExternalStorage,
              recursive: true,
            });
            showToast('Excel downloaded to Download folder');
            return;
          } catch (fsErr) {
            console.warn('Filesystem ExternalStorage failed, trying Documents:', fsErr);
            try {
              await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Documents,
                recursive: true,
              });
              showToast('Excel saved to Documents folder');
              return;
            } catch (docErr) {
              console.error('All native file writes failed:', docErr);
            }
          }
        }
      }

      // Web / Browser export
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      downloadAnchor.download = fileName;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('Excel file downloaded');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to export Excel file');
    }
  };

  // Import Excel (.xlsx/.xls) or JSON backup
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileNameLower = file.name.toLowerCase();

    if (fileNameLower.endsWith('.xlsx') || fileNameLower.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result;
          const wb = XLSX.read(buffer, { type: 'array' });
          const firstSheetName = wb.SheetNames[0];
          const sheet = wb.Sheets[firstSheetName];
          const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet);

          const imported: Subscription[] = rawRows
            .filter((row) => row['Service Name'] || row['name'] || row['Service'])
            .map((row, idx) => {
              const name = String(row['Service Name'] || row['name'] || row['Service'] || `Subscription ${idx + 1}`).trim();
              const price = parseFloat(String(row['Price'] || row['price'] || row['Cost'] || row['Amount'] || 0)) || 0;
              const currency = (row['Currency'] || row['currency'] || preferredCurrency) as Currency;
              const billingCycle =
                (row['Billing Cycle'] || row['billingCycle'] || row['Cycle'] || 'Monthly') === 'Yearly'
                  ? 'Yearly'
                  : 'Monthly';

              let category: Category = 'Other';
              const rawCat = row['Category'] || row['category'];
              if (rawCat && (Object.keys(CATEGORY_CONFIG) as string[]).includes(String(rawCat))) {
                category = rawCat as Category;
              }

              let renewalDate = String(row['Renewal Date'] || row['renewalDate'] || '').trim();
              if (!renewalDate || !/^\d{4}-\d{2}-\d{2}$/.test(renewalDate)) {
                renewalDate = getFutureDate(30);
              }

              const notes = row['Notes'] || row['notes'] ? String(row['Notes'] || row['notes']).trim() : undefined;

              return {
                id: `sub_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
                name,
                price,
                currency,
                billingCycle,
                renewalDate,
                category,
                notes,
                createdAt: Date.now(),
              };
            });

          if (imported.length > 0) {
            setSubscriptions(imported);
            showToast(`Imported ${imported.length} subscriptions from Excel`);
          } else {
            alert('No valid subscriptions found in this Excel sheet.');
          }
        } catch (err) {
          console.error('Import error:', err);
          alert('Could not parse Excel file.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // JSON backup fallback
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (Array.isArray(imported)) {
            setSubscriptions(imported);
            showToast(`Imported ${imported.length} subscriptions`);
          } else {
            alert('Invalid format: Expected a subscription list.');
          }
        } catch {
          alert('Could not parse JSON file.');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#f1f3f4] text-[#202124] flex flex-col justify-start md:justify-center items-center p-0 md:py-6 md:px-6 select-none">
      {/* App Container: Mobile phone card on small screens, expands to spacious Tablet/PC layout on md+ */}
      <div className="w-full max-w-md md:max-w-5xl lg:max-w-6xl xl:max-w-7xl bg-white border-x md:border border-[#dadce0] md:rounded-3xl shadow-sm h-screen h-[100dvh] md:h-[90vh] md:max-h-[960px] flex flex-col md:flex-row overflow-hidden relative">
        {/* --- Left Navigation Sidebar (Tablet & PC) --- */}
        <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 border-r border-[#dadce0] bg-[#f8fafd] flex-col justify-between p-5 z-20">
          <div className="space-y-6">
            {/* Logo & App Title */}
            <div className="flex items-center gap-3">
              <img
                src={appIcon}
                alt="SubTrack Icon"
                className="w-10 h-10 rounded-xl object-contain shadow-xs border border-[#dadce0] bg-white p-0.5 select-none"
              />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-[#202124] leading-tight">SubTrack</h1>
                <p className="text-[11px] text-[#5f6368] font-medium">Subscription Tracker</p>
              </div>
            </div>

            {/* User Profile Card */}
            <div className="p-3 bg-white rounded-2xl border border-[#dadce0] flex items-center gap-3 shadow-xs">
              <div title={`Profile: ${userName}`}>
                {renderAvatar(userAvatar, userName, 'w-10 h-10', 'text-xs')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#202124] truncate">{userName}</p>
                <p className="text-[11px] text-[#5f6368] font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#34a853]" />
                  Active Profile
                </p>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleOpenAddModal}
              className="w-full flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs py-3 px-4 rounded-full shadow-sm hover:shadow active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 text-white stroke-[2.5]" />
              <span>Add Subscription</span>
            </button>

            {/* Sidebar Navigation */}
            <nav className="space-y-1">
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSearchQuery('');
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${selectedCategory === 'All' && !searchQuery
                  ? 'bg-[#e8f0fe] text-[#1a73e8] font-semibold'
                  : 'text-[#3c4043] hover:bg-white hover:text-[#202124]'
                  }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4" />
                  <span>All Subscriptions</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-white text-[#5f6368] border border-[#dadce0] text-[10px]">
                  {subscriptions.length}
                </span>
              </button>

              <button
                onClick={handleOpenSettings}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium text-[#3c4043] hover:bg-white hover:text-[#202124] transition"
              >
                <div className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4 text-[#5f6368]" />
                  <span>Settings &amp; Preferences</span>
                </div>
                <span className="text-xs font-bold text-[#1a73e8]">{preferredCurrency}</span>
              </button>
            </nav>
          </div>

          {/* Bottom Sidebar Status */}
          <div className="pt-4 border-t border-[#dadce0] space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-[#5f6368] px-1">
              <ShieldCheck className="w-4 h-4 text-[#34a853] shrink-0" />
              <span>100% Offline Storage</span>
            </div>
            <p className="text-[10px] text-[#80868b] px-1">
              Privacy-first • Stored locally
            </p>
          </div>
        </aside>

        {/* --- Top Navigation Header (Mobile Only) --- */}
        <header className="md:hidden shrink-0 px-5 pt-3.5 pb-3 flex items-center justify-between border-b border-[#dadce0] bg-white z-20">
          <div className="flex items-center gap-3">
            {/* Profile Avatar (Dynamic: chosen image or initials) */}
            <div title={`Profile: ${userName}`}>
              {renderAvatar(userAvatar, userName, 'w-9 h-9', 'text-xs')}
            </div>
            <div>
              {/* Service title (offline tag removed) */}
              <h1 className="text-lg font-bold tracking-tight text-[#202124] leading-tight">SubTrack</h1>
              <p className="text-[11px] text-[#5f6368] font-medium">{userName}&apos;s Tracker</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Settings Icon Button */}
            <button
              onClick={handleOpenSettings}
              title="Settings (Currency, Profile &amp; Data)"
              className="p-2 rounded-full text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] transition"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* --- Scrollable Content Body --- */}
        <div className="flex-1 overflow-y-auto flex flex-col min-w-0 bg-white">
          {/* Top Dashboard Row: Spending Overview besides Search & Filter on md+ */}
          <div className="p-4 md:p-6 border-b border-[#dadce0]/80 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 items-start">
            {/* Left: Monthly & Yearly Spend Overview Widgets */}
            <div className="bg-[#f8fafd] rounded-2xl border border-[#dadce0] p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#5f6368] tracking-wider uppercase">
                  Spending Overview
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white text-[#3c4043] border border-[#dadce0]">
                  {subscriptions.length} active
                </span>
              </div>

              {/* Flat Metric Tiles */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white rounded-xl p-3 border border-[#dadce0]">
                  <p className="text-[11px] font-medium text-[#5f6368] mb-0.5">Monthly Spend</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tracking-tight text-[#202124]">
                      {preferredCurrency}
                      {monthlySpend.toFixed(2)}
                    </span>
                    <span className="text-xs text-[#1a73e8] font-medium">/mo</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-3 border border-[#dadce0]">
                  <p className="text-[11px] font-medium text-[#5f6368] mb-0.5">Annualized</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tracking-tight text-[#202124]">
                      {preferredCurrency}
                      {annualSpend.toFixed(2)}
                    </span>
                    <span className="text-xs text-[#5f6368] font-medium">/yr</span>
                  </div>
                </div>
              </div>

              {/* Flat Category Distribution Bar */}
              {totalMonthlySpend > 0 && (
                <div>
                  <div className="flex justify-between items-center text-[11px] text-[#5f6368] mb-1.5">
                    <span>Category Distribution</span>
                    <span className="text-[#80868b]">{subscriptions.length} subscriptions</span>
                  </div>
                  <div className="w-full h-2 bg-[#e8eaed] rounded-full flex overflow-hidden gap-0.5">
                    {(Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => {
                      const spend = categoryBreakdown[cat] || 0;
                      if (spend <= 0) return null;
                      const percent = (spend / totalMonthlySpend) * 100;
                      return (
                        <div
                          key={cat}
                          title={`${cat}: ${preferredCurrency}${spend.toFixed(2)}/mo (${percent.toFixed(0)}%)`}
                          style={{ width: `${percent}%` }}
                          className={`h-full ${CATEGORY_CONFIG[cat].barColor}`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Search Bar, Category Filter Chips & Sort Tabs (Besides Spend Widgets on md+) */}
            <div className="space-y-3 flex flex-col justify-between h-full">
              {/* Google Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#5f6368] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subscriptions or category..."
                  className="w-full bg-[#f1f3f4] hover:bg-[#e8eaed] focus:bg-white border border-transparent focus:border-[#1a73e8] rounded-full pl-9 pr-8 py-2.5 text-sm text-[#202124] placeholder-[#5f6368] outline-none transition focus:ring-2 focus:ring-[#1a73e8]/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5f6368] hover:text-[#202124] p-0.5 rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Material 3 Category Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                <button
                  onClick={() => setSelectedCategory('All')}
                  className={`px-3.5 py-1.5 rounded-full font-medium transition whitespace-nowrap border ${selectedCategory === 'All'
                    ? 'bg-[#e8f0fe] text-[#1a73e8] border-[#d2e3fc] font-semibold'
                    : 'bg-white text-[#5f6368] border-[#dadce0] hover:bg-[#f1f3f4]'
                    }`}
                >
                  All ({subscriptions.length})
                </button>
                {(Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => {
                  const count = subscriptions.filter((s) => s.category === cat).length;
                  if (count === 0) return null;
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-full font-medium transition whitespace-nowrap border ${isSelected
                        ? `${CATEGORY_CONFIG[cat].badgeStyle} font-semibold`
                        : 'bg-white text-[#5f6368] border-[#dadce0] hover:bg-[#f1f3f4]'
                        }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Clean Sort Tabs */}
              <div className="flex items-center justify-between text-xs text-[#5f6368] px-1 pt-1">
                <span>
                  Order:{' '}
                  <span className="text-[#1a73e8] font-semibold">
                    {sortBy === 'renewal'
                      ? 'Renewal (Soonest)'
                      : sortBy === 'price'
                        ? 'Cost (Highest)'
                        : 'Name (A-Z)'}
                  </span>
                </span>
                <div className="flex items-center gap-1 bg-[#f1f3f4] p-0.5 rounded-lg border border-[#dadce0] text-[11px]">
                  <button
                    onClick={() => setSortBy('renewal')}
                    className={`px-2 py-0.5 rounded-md transition ${sortBy === 'renewal' ? 'bg-white text-[#1a73e8] font-semibold shadow-sm' : 'hover:text-[#202124]'
                      }`}
                  >
                    Renewal
                  </button>
                  <button
                    onClick={() => setSortBy('price')}
                    className={`px-2 py-0.5 rounded-md transition ${sortBy === 'price' ? 'bg-white text-[#1a73e8] font-semibold shadow-sm' : 'hover:text-[#202124]'
                      }`}
                  >
                    Cost
                  </button>
                  <button
                    onClick={() => setSortBy('name')}
                    className={`px-2 py-0.5 rounded-md transition ${sortBy === 'name' ? 'bg-white text-[#1a73e8] font-semibold shadow-sm' : 'hover:text-[#202124]'
                      }`}
                  >
                    Name
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* --- Subscriptions List (Google Clean Cards) --- */}
          <section className="px-4 md:px-6 py-4 flex-1 pb-24 md:pb-6">
            {filteredSubscriptions.length === 0 ? (
              subscriptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center rounded-2xl border border-dashed border-[#dadce0] bg-[#f8fafd]">
                  <EmptyStateIllustration className="w-56 sm:w-64 max-w-full h-auto mb-3" />
                  <h3 className="text-sm font-semibold text-[#202124] mb-1">
                    No subscriptions yet
                  </h3>
                  <p className="text-xs text-[#5f6368] max-w-xs">
                    Add your subscriptions to track renewals and spending 100% offline.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-[#dadce0] bg-[#f8fafd]">
                  <div className="w-12 h-12 rounded-full bg-[#f1f3f4] border border-[#dadce0] flex items-center justify-center text-[#5f6368] mb-3">
                    <Search className="w-6 h-6 text-[#5f6368]" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#202124] mb-1">
                    No matching subscriptions
                  </h3>
                  <p className="text-xs text-[#5f6368] max-w-xs mb-4">
                    Try clearing your search query or picking another category.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="text-xs text-[#1a73e8] hover:underline font-medium"
                  >
                    Clear filters
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-2.5 md:space-y-0 md:grid md:grid-cols-2 xl:grid-cols-3 md:gap-3.5">
                {filteredSubscriptions.map((sub, index) => (
                  <SubscriptionCard
                    key={sub.id || `sub-card-${index}-${sub.name}`}
                    sub={sub}
                    preferredCurrency={preferredCurrency}
                    onEdit={handleOpenEditModal}
                    onDelete={setSubToDelete}
                    onMarkRenewed={handleMarkAsRenewed}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* --- Floating Bottom FAB & Status (Mobile Only) --- */}
        <div className="md:hidden absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white/95 to-transparent pointer-events-none z-30">
          <div className="flex items-center justify-between gap-3 pointer-events-auto">
            <div className="text-[11px] text-[#5f6368] bg-white border border-[#dadce0] px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-[#34a853] shrink-0" />
              <span>Offline Device Storage</span>
            </div>

            {/* Google FAB Button */}
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs px-4 py-2.5 rounded-full shadow-md hover:shadow-lg active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 text-white stroke-[2.5]" />
              <span>Add Subscription</span>
            </button>
          </div>
        </div>

        {/* --- Add / Edit Modal (Google Material Dialog) --- */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150">
            <div
              className="w-full max-w-md bg-white border-t sm:border border-[#dadce0] rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-[#dadce0] flex items-center justify-between bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center">
                    {editingSub ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <h3 className="text-base font-semibold text-[#202124]">
                    {editingSub ? 'Edit Subscription' : 'New Subscription'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 text-[#5f6368] hover:text-[#202124] rounded-full hover:bg-[#f1f3f4] transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveSubscription} className="p-5 overflow-y-auto space-y-4">
                {/* Quick Presets */}
                {!editingSub && (
                  <div>
                    <label className="text-[11px] font-medium text-[#5f6368] uppercase tracking-wider block mb-1.5">
                      Quick Suggestions
                    </label>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => applyPreset(preset)}
                          className="text-xs px-2.5 py-1 rounded-full bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#3c4043] border border-[#dadce0] whitespace-nowrap transition active:scale-95"
                        >
                          + {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Service Name */}
                <div>
                  <label className="text-xs font-medium text-[#3c4043] block mb-1.5">
                    Service Name <span className="text-[#d93025]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }));
                    }}
                    placeholder="e.g. netflix, general insurance, ERP"
                    className={`w-full bg-white border ${formErrors.name ? 'border-[#d93025]' : 'border-[#dadce0]'
                      } focus:border-[#1a73e8] rounded-xl px-3.5 py-2.5 text-sm text-[#202124] placeholder-[#80868b] outline-none transition focus:ring-2 focus:ring-[#1a73e8]/20`}
                  />
                  {formErrors.name && (
                    <p className="text-xs text-[#d93025] mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {formErrors.name}
                    </p>
                  )}
                </div>

                {/* Price (Currency automatically fetched from Settings) */}
                <div>
                  <label className="text-xs font-medium text-[#3c4043] block mb-1.5">
                    Price ({preferredCurrency}) <span className="text-[#d93025]">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#5f6368] font-medium text-sm pointer-events-none">
                      {preferredCurrency}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formPrice}
                      onChange={(e) => {
                        setFormPrice(e.target.value);
                        if (formErrors.price) setFormErrors((prev) => ({ ...prev, price: undefined }));
                      }}
                      placeholder="0.00"
                      className={`w-full bg-white border ${formErrors.price ? 'border-[#d93025]' : 'border-[#dadce0]'
                        } focus:border-[#1a73e8] rounded-xl pl-8 pr-3.5 py-2.5 text-sm text-[#202124] placeholder-[#80868b] outline-none transition focus:ring-2 focus:ring-[#1a73e8]/20 font-medium`}
                    />
                  </div>
                  {formErrors.price && (
                    <p className="text-xs text-[#d93025] mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {formErrors.price}
                    </p>
                  )}
                </div>

                {/* Billing Cycle Toggle */}
                <div>
                  <label className="text-xs font-medium text-[#3c4043] block mb-1.5">
                    Billing Cycle
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-[#f1f3f4] p-1 rounded-xl border border-[#dadce0]">
                    <button
                      type="button"
                      onClick={() => setFormCycle('Monthly')}
                      className={`py-2 text-xs font-medium rounded-lg transition ${formCycle === 'Monthly'
                        ? 'bg-white text-[#1a73e8] font-semibold shadow-sm'
                        : 'text-[#5f6368] hover:text-[#202124]'
                        }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormCycle('Yearly')}
                      className={`py-2 text-xs font-medium rounded-lg transition ${formCycle === 'Yearly'
                        ? 'bg-white text-[#1a73e8] font-semibold shadow-sm'
                        : 'text-[#5f6368] hover:text-[#202124]'
                        }`}
                    >
                      Yearly
                    </button>
                  </div>
                </div>

                {/* Next Renewal Date Picker */}
                <div>
                  <label className="text-xs font-medium text-[#3c4043] block mb-1.5">
                    Next Renewal Date <span className="text-[#d93025]">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => {
                        setFormDate(e.target.value);
                        if (formErrors.date) setFormErrors((prev) => ({ ...prev, date: undefined }));
                      }}
                      className={`w-full bg-white border ${formErrors.date ? 'border-[#d93025]' : 'border-[#dadce0]'
                        } focus:border-[#1a73e8] rounded-xl px-3.5 py-2.5 text-sm text-[#202124] outline-none transition focus:ring-2 focus:ring-[#1a73e8]/20`}
                    />
                  </div>
                  {formErrors.date && (
                    <p className="text-xs text-[#d93025] mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {formErrors.date}
                    </p>
                  )}
                </div>

                {/* Category Preset Selector */}
                <div>
                  <label className="text-xs font-medium text-[#3c4043] block mb-1.5">Category</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => {
                      const Icon = CATEGORY_CONFIG[cat].icon;
                      const isSelected = formCategory === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormCategory(cat)}
                          className={`flex items-center gap-1.5 p-2 rounded-xl border text-xs font-medium transition ${isSelected
                            ? `${CATEGORY_CONFIG[cat].badgeStyle} font-semibold ring-1 ring-[#1a73e8]`
                            : 'bg-white border-[#dadce0] text-[#5f6368] hover:bg-[#f1f3f4]'
                            }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="truncate">{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Notes */}
                <div>
                  <label className="text-xs font-medium text-[#3c4043] block mb-1.5">
                    Notes / Plan Details <span className="text-[#80868b] font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Student tier, family plan"
                    className="w-full bg-white border border-[#dadce0] focus:border-[#1a73e8] rounded-xl px-3.5 py-2 text-xs text-[#202124] placeholder-[#80868b] outline-none transition focus:ring-2 focus:ring-[#1a73e8]/20"
                  />
                </div>

                {/* Modal Action Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="py-2.5 px-5 rounded-full text-[#1a73e8] hover:bg-[#f1f3f4] font-medium text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-6 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs transition shadow-sm active:scale-95"
                  >
                    {editingSub ? 'Update Subscription' : 'Save Subscription'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- Settings Modal (Profile, Currency & Data Management) --- */}
        {isSettingsOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150"
            onClick={() => setIsSettingsOpen(false)}
          >
            <div
              className="w-full max-w-md bg-white border-t sm:border border-[#dadce0] rounded-t-3xl sm:rounded-3xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Settings Header with Mobile Back Button */}
              <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[#dadce0] flex items-center justify-between bg-white">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1.5 -ml-1 text-[#5f6368] hover:text-[#202124] hover:bg-[#f1f3f4] rounded-full transition active:scale-95 flex items-center justify-center"
                    title="Back / Exit"
                    aria-label="Back / Exit"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-8 h-8 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center shrink-0">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#202124] leading-tight">Settings</h3>
                    <p className="text-[11px] text-[#5f6368]">Profile &amp; Preferences</p>
                  </div>
                </div>
              </div>

              {/* Settings Body with Fixed Bottom Footer */}
              <form onSubmit={handleSaveSettings} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-5 overflow-y-auto space-y-5 flex-1 min-h-0">
                  {/* 1. User Profile Section with Avatar Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider block">
                    User Profile
                  </label>
                  <div className="bg-[#f8fafd] border border-[#dadce0] rounded-2xl p-4 flex items-center gap-3.5">
                    {/* Live Preview of Avatar */}
                    <div className="shrink-0">
                      {renderAvatar(tempUserAvatar, tempUserName, 'w-12 h-12', 'text-sm')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-[11px] font-medium text-[#5f6368] block mb-1">
                        Full Name (First &amp; Last)
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-[#5f6368] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={tempUserName}
                          onChange={(e) => setTempUserName(e.target.value)}
                          placeholder="e.g. Alex Miller"
                          className="w-full bg-white border border-[#dadce0] focus:border-[#1a73e8] rounded-xl pl-9 pr-3.5 py-2 text-sm text-[#202124] outline-none transition focus:ring-2 focus:ring-[#1a73e8]/20 font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Avatar Picker (App Stack) */}
                  <div>
                    <label className="text-[11px] font-medium text-[#5f6368] block mb-1.5">
                      Choose Avatar
                    </label>
                    <div className="bg-[#f8fafd] border border-[#dadce0] rounded-2xl p-3 flex items-center gap-2.5 overflow-x-auto scrollbar-none">
                      {AVATAR_OPTIONS.map((item) => {
                        const isSelected = tempUserAvatar === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setTempUserAvatar(item.id)}
                            className="group flex flex-col items-center shrink-0 transition active:scale-95 focus:outline-none"
                            title={item.label}
                          >
                            <div
                              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all relative ${isSelected
                                ? 'ring-2 ring-[#1a73e8] ring-offset-2 scale-105 shadow-md'
                                : 'opacity-80 hover:opacity-100 shadow-sm'
                                }`}
                            >
                              {item.isInitials ? (
                                <div className="w-full h-full rounded-full bg-[#1a73e8] text-white flex items-center justify-center font-bold text-xs select-none">
                                  {getUserInitials(tempUserName)}
                                </div>
                              ) : (
                                <img
                                  src={item.src}
                                  alt={item.label}
                                  className="w-full h-full rounded-full object-cover border border-[#dadce0] bg-white select-none"
                                />
                              )}
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#188038] text-white flex items-center justify-center text-[9px] shadow-sm border border-white font-bold">
                                  ✓
                                </div>
                              )}
                            </div>
                            <span
                              className={`mt-1.5 text-[10px] font-medium tracking-tight text-center ${isSelected ? 'text-[#1a73e8] font-bold' : 'text-[#5f6368] group-hover:text-[#202124]'
                                }`}
                            >
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. Currency Option Section (App Drawer Style) */}
                <div>
                  <label className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider block mb-2">
                    Default Currency
                  </label>

                  {/* Single Line App Drawer Row */}
                  <div className="bg-[#f8fafd] border border-[#dadce0] rounded-2xl p-3.5 flex items-center justify-between gap-2">
                    {CURRENCY_OPTIONS.map((item) => {
                      const isSelected = tempCurrency === item.code;
                      return (
                        <button
                          key={item.code}
                          type="button"
                          onClick={() => setTempCurrency(item.code)}
                          className="group flex flex-col items-center flex-1 transition active:scale-95 focus:outline-none"
                          title={`${item.desc} (${item.code})`}
                        >
                          {/* Round App Drawer Icon */}
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all relative ${isSelected
                              ? 'bg-[#1a73e8] text-white shadow-md ring-2 ring-[#1a73e8] ring-offset-2 scale-105'
                              : 'bg-white text-[#202124] border border-[#dadce0] group-hover:border-[#bdc1c6] group-hover:bg-[#f1f3f4] shadow-sm'
                              }`}
                          >
                            <span>{item.code}</span>
                            {isSelected && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#188038] text-white flex items-center justify-center text-[10px] shadow-sm border border-white font-bold">
                                ✓
                              </div>
                            )}
                          </div>

                          {/* App Drawer Label */}
                          <span
                            className={`mt-1.5 text-xs font-semibold tracking-tight text-center ${isSelected ? 'text-[#1a73e8]' : 'text-[#3c4043] group-hover:text-[#202124]'
                              }`}
                          >
                            {item.short}
                          </span>
                          <span className="text-[10px] text-[#80868b] text-center leading-none">
                            {item.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Offline Data & Backups */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-[#5f6368] uppercase tracking-wider block">
                      Data Management
                    </label>
                    <span className="text-[10px] text-[#188038] font-medium bg-[#e6f4ea] px-2 py-0.5 rounded-full border border-[#ceead6]">
                      Excel &amp; Backup
                    </span>
                  </div>
                  <div className="bg-[#f8fafd] border border-[#dadce0] rounded-2xl p-3.5 text-xs">
                    <p className="text-[11px] text-[#5f6368] mb-2.5">
                      Export your subscriptions into an Excel spreadsheet (.xlsx) or restore from an Excel or JSON backup.
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleExportData}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white hover:bg-[#f1f3f4] text-[#1a73e8] border border-[#dadce0] hover:border-[#1a73e8] rounded-xl font-medium transition shadow-xs active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5 text-[#1a73e8]" />
                        <span>Export Excel (.xlsx)</span>
                      </button>

                      <label className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white hover:bg-[#f1f3f4] text-[#202124] border border-[#dadce0] rounded-xl font-medium transition cursor-pointer shadow-xs active:scale-95">
                        <Upload className="w-3.5 h-3.5 text-[#5f6368]" />
                        <span>Import File</span>
                        <input
                          type="file"
                          accept=".xlsx, .xls, .json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                          onChange={handleImportData}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                </div>

                {/* Fixed Bottom Footer (Mobile, Tablet & Desktop) */}
                <div className="p-3.5 sm:px-5 sm:py-3.5 border-t border-[#dadce0] bg-white shrink-0 flex items-center justify-end shadow-[0_-2px_8px_rgba(0,0,0,0.04)] z-10">
                  <button
                    ref={saveButtonRef}
                    type="submit"
                    disabled={!hasSettingsChanged}
                    className={`w-full sm:w-auto py-2.5 px-6 rounded-full font-medium text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-1.5 focus:ring-2 focus:ring-[#1a73e8]/40 focus:outline-none ${
                      hasSettingsChanged
                        ? 'bg-[#1a73e8] hover:bg-[#1557b0] text-white cursor-pointer shadow-md'
                        : 'bg-[#f1f3f4] text-[#80868b] cursor-not-allowed border border-[#dadce0]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- First-Time Setup & Onboarding Modal (Appears in 2s if no cache found) --- */}
        {isOnboardingOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200">
            <div
              className="w-full max-w-md bg-white border border-[#dadce0] rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with App Icon */}
              <div className="px-6 pt-6 pb-3 text-center border-b border-[#f1f3f4] bg-white">
                <div className="w-12 h-12 rounded-2xl bg-[#f8fafd] border border-[#dadce0] p-1.5 mx-auto mb-2 flex items-center justify-center shadow-xs">
                  <img src={appIcon} alt="SubTrack" className="w-full h-full object-contain" />
                </div>
                <h3 className="text-lg font-bold text-[#202124] tracking-tight">
                  Welcome to SubTrack
                </h3>
                <p className="text-xs text-[#5f6368] mt-0.5">
                  Set up your profile and preferences to get started
                </p>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveOnboarding} className="p-6 overflow-y-auto space-y-4">
                {/* 1. User Name */}
                <div>
                  <label className="text-xs font-semibold text-[#3c4043] block mb-1.5">
                    User Name <span className="text-[#d93025]">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#5f6368] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={onboardingName}
                      onChange={(e) => {
                        setOnboardingName(e.target.value);
                        if (onboardingError) setOnboardingError(null);
                      }}
                      placeholder="e.g. Alex Miller"
                      className={`w-full bg-[#f8fafd] border rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-[#202124] placeholder-[#80868b] outline-none transition focus:bg-white focus:ring-2 focus:ring-[#1a73e8]/20 ${onboardingError ? 'border-[#d93025]' : 'border-[#dadce0] focus:border-[#1a73e8]'
                        }`}
                    />
                  </div>
                  {onboardingError && (
                    <p className="text-[11px] text-[#d93025] mt-1">{onboardingError}</p>
                  )}
                </div>

                {/* 2. Select Avatar / Icon */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#3c4043]">
                      Select Profile Icon
                    </label>
                    <span className="text-[11px] text-[#5f6368]">
                      Pick your avatar
                    </span>
                  </div>
                  <div className="bg-[#f8fafd] border border-[#dadce0] rounded-2xl p-2.5">
                    <div className="grid grid-cols-7 gap-1.5">
                      {AVATAR_OPTIONS.map((item) => {
                        const isSelected = onboardingAvatar === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setOnboardingAvatar(item.id)}
                            className="flex flex-col items-center group transition active:scale-95 focus:outline-none"
                            title={item.label}
                          >
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center relative transition-all ${isSelected
                                ? 'ring-2 ring-[#1a73e8] ring-offset-2 scale-105 shadow-sm'
                                : 'hover:opacity-85'
                                }`}
                            >
                              {item.isInitials ? (
                                <div className="w-full h-full rounded-full bg-[#1a73e8] text-white flex items-center justify-center font-bold text-xs shadow-xs select-none">
                                  {getUserInitials(onboardingName || 'JD')}
                                </div>
                              ) : (
                                <img
                                  src={item.src}
                                  alt={item.label}
                                  className="w-full h-full rounded-full object-cover border border-[#dadce0] bg-white select-none"
                                />
                              )}
                              {isSelected && (
                                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#188038] text-white flex items-center justify-center text-[9px] shadow-sm border border-white font-bold">
                                  ✓
                                </div>
                              )}
                            </div>
                            <span
                              className={`mt-1 text-[9px] font-medium tracking-tight text-center truncate max-w-[44px] ${isSelected ? 'text-[#1a73e8] font-bold' : 'text-[#5f6368]'
                                }`}
                            >
                              {item.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Select Currency */}
                <div>
                  <label className="text-xs font-semibold text-[#3c4043] block mb-1.5">
                    Select Currency
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {CURRENCY_OPTIONS.map((curr) => {
                      const isSelected = onboardingCurrency === curr.code;
                      return (
                        <button
                          key={curr.code}
                          type="button"
                          onClick={() => setOnboardingCurrency(curr.code)}
                          className={`py-2 px-2 rounded-xl border flex flex-col items-center justify-center transition active:scale-95 ${isSelected
                            ? 'bg-[#e8f0fe] border-[#1a73e8] text-[#1a73e8] shadow-xs font-bold ring-1 ring-[#1a73e8]'
                            : 'bg-[#f8fafd] border-[#dadce0] text-[#3c4043] hover:bg-white'
                            }`}
                        >
                          <span className="text-base font-bold leading-tight">{curr.code}</span>
                          <span className="text-[10px] font-medium opacity-80">{curr.short}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Notice line requested by user */}
                <div className="bg-[#f8fafd] border border-[#e8eaed] rounded-xl py-2.5 px-3 text-center">
                  <p className="text-[11px] text-[#5f6368] font-medium leading-relaxed">
                    You can change this in settings later
                  </p>
                </div>

                {/* 5. Submit Button */}
                <div className="pt-1">
                  <button
                    type="submit"
                    className="w-full py-3 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-xs transition shadow-sm active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>Get Started</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- Delete Confirmation Modal (Google Alert Style) --- */}
        {subToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-white border border-[#dadce0] rounded-3xl p-5 shadow-xl">
              <div className="w-12 h-12 rounded-full bg-[#fce8e6] text-[#d93025] flex items-center justify-center mb-3 mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-center text-[#202124] mb-1">
                Delete &ldquo;{subToDelete.name}&rdquo;?
              </h3>
              <p className="text-xs text-[#5f6368] text-center mb-5 leading-relaxed">
                This will remove the subscription from your local tracker. This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setSubToDelete(null)}
                  className="w-1/2 py-2.5 rounded-full text-[#5f6368] hover:bg-[#f1f3f4] font-medium text-xs transition border border-[#dadce0]"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="w-1/2 py-2.5 rounded-full bg-[#d93025] hover:bg-[#b3261e] text-white font-medium text-xs transition shadow-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- Material Toast Snackbar --- */}
        {toastMessage && (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#323232] text-white text-xs py-2.5 px-4 rounded-full shadow-lg animate-in slide-in-from-bottom-3 duration-150">
            <CheckCircle2 className="w-4 h-4 text-[#81c995] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
