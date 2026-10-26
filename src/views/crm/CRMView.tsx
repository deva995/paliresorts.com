import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer } from '../../types';
import {
  HeartHandshake,
  Award,
  Star,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Search,
  Phone,
  Mail,
  UserCheck,
  ChevronRight,
  Sparkles,
  X
} from 'lucide-react';

export const CRMView: React.FC = () => {
  const { customers, currentRoute, pushRoute } = useApp();

  const [reviews, setReviews] = useState([
    {
      id: 'rev-1',
      guest: 'Vikramaditya Singhania',
      tier: 'Diamond VIP',
      rating: 5,
      comment: 'Exceptional hospitality. The Dal Makhani and royal suite service were truly world class.',
      date: 'Yesterday'
    },
    {
      id: 'rev-2',
      guest: 'Priya Sharma',
      tier: 'Platinum',
      rating: 4.8,
      comment: 'Very seamless mobile QR menu experience. Fast check-in at front desk.',
      date: '2 days ago'
    }
  ]);

  const [complaints, setComplaints] = useState([
    {
      id: 'comp-1',
      guest: 'Amitabh Joshi',
      roomOrTable: 'Room 202',
      issue: 'AC thermostat cooling delayed on arrival.',
      status: 'resolved',
      solution: 'Complimentary dessert provided + technician repaired thermostat.'
    }
  ]);

  const [search, setSearch] = useState('');

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.tier.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-sky-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Guest CRM & Loyalty Privilege Program
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Personalized guest preferences, loyalty points accrual, VIP recognition, and feedback resolution.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-bold uppercase">Enrolled Club Members</span>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            {customers.length} Guests
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold">100% repeat retention rate</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-bold uppercase">Guest Satisfaction Index</span>
          <div className="text-2xl font-black text-amber-500 font-mono mt-1 flex items-center gap-1">
            <span>4.9</span>
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          </div>
          <span className="text-[11px] text-slate-400">Based on 148 verified dining & stay reviews</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <span className="text-xs text-slate-500 font-bold uppercase">Loyalty Points Issued</span>
          <div className="text-2xl font-black text-[#163024] font-mono mt-1">
            {customers.reduce((acc, c) => acc + (c.loyaltyPoints || 0), 0).toLocaleString('en-IN')} Pts
          </div>
          <span className="text-[11px] text-slate-400">Redeemable against spa, dining & suite upgrades</span>
        </div>
      </div>

      {/* Customers List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-sm px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search member name, tier, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-transparent outline-none text-slate-800"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5">Guest Profile</th>
                <th className="p-3.5">Loyalty Tier</th>
                <th className="p-3.5">Total Stays & Visits</th>
                <th className="p-3.5">Lifetime Spend (₹)</th>
                <th className="p-3.5">Points Balance</th>
                <th className="p-3.5">Special Dietary & Preferences</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map(cust => (
                <tr key={cust.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-3.5">
                    <p className="font-bold text-slate-900">{cust.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{cust.phone}</p>
                  </td>
                  <td className="p-3.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        cust.tier === 'Diamond'
                          ? 'bg-[#163024] text-[#F7F4EC] border border-[#C5A86A]'
                          : cust.tier === 'Platinum'
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {cust.tier} Member
                    </span>
                  </td>
                  <td className="p-3.5 font-bold font-mono">{cust.totalVisits} Visits</td>
                  <td className="p-3.5 font-mono font-bold text-slate-900">
                    ₹{(cust.totalSpent ?? 0).toLocaleString('en-IN')}
                  </td>
                  <td className="p-3.5 font-mono font-bold text-[#526B4A]">
                    {(cust.loyaltyPoints ?? 0).toLocaleString('en-IN')} pts
                  </td>
                  <td className="p-3.5 text-slate-600 max-w-xs truncate">
                    {cust.notes || 'Allergies: None. Prefers high-floor quiet rooms.'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Guest Reviews & Complaints Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
            Recent Guest Reviews
          </h3>
          <div className="space-y-3">
            {reviews.map(r => (
              <div key={r.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">{r.guest} ({r.tier})</span>
                  <div className="flex text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-slate-600 leading-relaxed italic">"{r.comment}"</p>
                <span className="text-[10px] text-slate-400">{r.date}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[#163024]" />
            Service Resolution & Complaints Log
          </h3>
          <div className="space-y-3">
            {complaints.map(c => (
              <div key={c.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">{c.guest} • {c.roomOrTable}</span>
                  <span className="text-[10px] uppercase font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {c.status}
                  </span>
                </div>
                <p className="text-slate-700 font-medium">{c.issue}</p>
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-600">
                  <strong>Resolution:</strong> {c.solution}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
