'use client';

import Link from 'next/link';
import { Swords, Shield, Monitor, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center p-8">
      <div className="text-center mb-12">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Swords className="w-16 h-16 text-purple-400" />
        </div>
        <h1 className="text-5xl font-bold text-white mb-4">
          AI Battle Royale
        </h1>
        <p className="text-xl text-gray-300">
          Real-time startup battle voting platform
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full">
        <Link
          href="/admin"
          className="group bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:bg-gray-800/70 hover:border-purple-500 transition-all duration-300"
        >
          <div className="flex flex-col items-center text-center">
            <Shield className="w-12 h-12 text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
            <h2 className="text-2xl font-semibold text-white mb-2">Admin Panel</h2>
            <p className="text-gray-400">
              Manage matches, upload startups, and control voting
            </p>
          </div>
        </Link>

        <Link
          href="/display"
          className="group bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:bg-gray-800/70 hover:border-purple-500 transition-all duration-300"
        >
          <div className="flex flex-col items-center text-center">
            <Monitor className="w-12 h-12 text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
            <h2 className="text-2xl font-semibold text-white mb-2">Display Panel</h2>
            <p className="text-gray-400">
              Show live match progress on TV screens
            </p>
          </div>
        </Link>

        <Link
          href="/vote"
          className="group bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 hover:bg-gray-800/70 hover:border-purple-500 transition-all duration-300"
        >
          <div className="flex flex-col items-center text-center">
            <Users className="w-12 h-12 text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
            <h2 className="text-2xl font-semibold text-white mb-2">Vote Panel</h2>
            <p className="text-gray-400">
              Cast your vote via QR code
            </p>
          </div>
        </Link>
      </div>

      <div className="mt-12 text-gray-500 text-sm">
        Scan QR codes to access voting panels
      </div>
    </div>
  );
}
