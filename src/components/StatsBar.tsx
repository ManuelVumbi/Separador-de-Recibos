import React from 'react';
import { Users, Coins, Percent, FileCheck } from 'lucide-react';
import { ReceiptData } from '../types/receipt';

interface StatsBarProps {
  receipts: ReceiptData[];
}

export const StatsBar: React.FC<StatsBarProps> = ({ receipts }) => {
  const totalEmployees = receipts.length;
  const totalNetPay = receipts.reduce((sum, r) => sum + r.netPay, 0);
  const totalEarnings = receipts.reduce((sum, r) => sum + r.totalEarnings, 0);
  const totalDeductions = receipts.reduce((sum, r) => sum + r.totalDeductions, 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Recibos Separados</span>
          <Users className="w-4 h-4 text-app-primary" />
        </div>
        <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white font-mono">
          {totalEmployees}
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          Processados e individualizados
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Líquido</span>
          <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="mt-2 text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
          {totalNetPay.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} <span className="text-xs font-normal">AKZ</span>
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          Valor total a transferir
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Remunerações</span>
          <FileCheck className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </div>
        <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
          {totalEarnings.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} <span className="text-xs font-normal">AKZ</span>
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          Salários, horas e prémios
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Descontos</span>
          <Percent className="w-4 h-4 text-rose-600 dark:text-rose-400" />
        </div>
        <div className="mt-2 text-xl font-bold text-rose-700 dark:text-rose-400 font-mono tabular-nums">
          {totalDeductions.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} <span className="text-xs font-normal">AKZ</span>
        </div>
        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          IRT + Segurança Social (3%)
        </div>
      </div>
    </div>
  );
};
