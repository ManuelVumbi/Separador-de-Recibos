import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Hash,
  Building2,
  Tag,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import { CollaboratorContact } from '../types/contact';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: CollaboratorContact | null;
  onSave: (contact: CollaboratorContact) => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  contact,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [mechanicalNumber, setMechanicalNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+244');
  const [phone, setPhone] = useState('');
  const [secondaryPhones, setSecondaryPhones] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (contact) {
      setName(contact.name || '');
      setMechanicalNumber(contact.mechanicalNumber || '');

      let p = contact.phone || '';
      if (p.startsWith('+244')) {
        setCountryCode('+244');
        p = p.replace('+244', '');
      } else if (p.startsWith('+351')) {
        setCountryCode('+351');
        p = p.replace('+351', '');
      } else if (p.startsWith('+55')) {
        setCountryCode('+55');
        p = p.replace('+55', '');
      } else if (p.startsWith('+258')) {
        setCountryCode('+258');
        p = p.replace('+258', '');
      }
      setPhone(p.trim());

      setSecondaryPhones(contact.secondaryPhones ? [...contact.secondaryPhones] : []);
      setEmail(contact.email || '');
      setDepartment(contact.department || '');
      setCategory(contact.category || '');
      setNotes(contact.notes || '');
    } else {
      setName('');
      setMechanicalNumber('');
      setCountryCode('+244');
      setPhone('');
      setSecondaryPhones([]);
      setEmail('');
      setDepartment('');
      setCategory('');
      setNotes('');
    }
    setError(null);
  }, [contact, isOpen]);

  if (!isOpen) return null;

  const handleAddSecondaryPhone = () => {
    setSecondaryPhones([...secondaryPhones, '']);
  };

  const handleSecondaryPhoneChange = (index: number, val: string) => {
    const updated = [...secondaryPhones];
    updated[index] = val;
    setSecondaryPhones(updated);
  };

  const handleRemoveSecondaryPhone = (index: number) => {
    setSecondaryPhones(secondaryPhones.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('O nome do colaborador é obrigatório.');
      return;
    }

    if (!phone.trim() && !email.trim()) {
      setError('Introduza pelo menos um número de telefone/WhatsApp ou endereço de e-mail.');
      return;
    }

    const fullPhone = phone.trim() ? `${countryCode}${phone.replace(/\D/g, '')}` : '';
    const cleanSecondary = secondaryPhones
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        if (p.startsWith('+')) return p;
        if (/^9\d{8}$/.test(p)) return `+244${p}`;
        return p;
      });

    const newContact: CollaboratorContact = {
      id: contact?.id || `contact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      mechanicalNumber: mechanicalNumber.trim() || undefined,
      phone: fullPhone,
      secondaryPhones: cleanSecondary,
      allPhones: [
        ...(fullPhone ? [{ number: fullPhone, isWhatsApp: true, label: 'WhatsApp Principal' }] : []),
        ...cleanSecondary.map((s, idx) => ({
          number: s,
          isWhatsApp: false,
          label: `Contacto Alternativo ${idx + 1}`,
        })),
      ],
      email: email.trim(),
      department: department.trim() || undefined,
      category: category.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: contact?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(newContact);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-inner">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                {contact ? 'Editar Contacto do Colaborador' : 'Novo Contacto de Colaborador'}
              </h2>
              <p className="text-xs text-slate-300">
                Grave múltiplos contactos e números de WhatsApp para envio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Nome Completo do Colaborador <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="Ex.: Alfredo Bumba João Macedo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white text-slate-900"
              />
            </div>
          </div>

          {/* N.º Mecanográfico */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              N.º Mecanográfico (Vinculação ao Recibo)
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Ex.: 10100"
                value={mechanicalNumber}
                onChange={(e) => setMechanicalNumber(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white text-slate-900"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Permite ligar este contacto automaticamente ao recibo de vencimento correspondente.
            </p>
          </div>

          {/* Telefone Principal / WhatsApp Prioritário */}
          <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Número Principal (Prioritário para WhatsApp)</span>
              </label>
              <span className="text-[10px] text-emerald-800 bg-emerald-100 font-semibold px-2 py-0.5 rounded-full">
                Prioritário
              </span>
            </div>

            <div className="flex gap-2">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-mono focus:ring-1 focus:ring-emerald-600"
              >
                <option value="+244">🇦🇴 +244 (Angola)</option>
                <option value="+351">🇵🇹 +351 (Portugal)</option>
                <option value="+55">🇧🇷 +55 (Brasil)</option>
                <option value="+258">🇲🇿 +258 (Moçambique)</option>
                <option value="+238">🇨🇻 +238 (Cabo Verde)</option>
              </select>

              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ex.: 923 101 001"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600 text-slate-900"
                />
              </div>
            </div>

            {/* Secondary / Alternative Phones */}
            {secondaryPhones.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Contactos Adicionais / Alternativos:
                </label>
                {secondaryPhones.map((sec, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Ex.: +244 924 555 12${idx + 1}`}
                      value={sec}
                      onChange={(e) => handleSecondaryPhoneChange(idx, e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSecondaryPhone(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Remover este contacto alternativo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleAddSecondaryPhone}
              className="mt-1 text-[11px] font-semibold text-blue-800 hover:text-blue-950 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Adicionar Outro Contacto / Número Alternativo</span>
            </button>
          </div>

          {/* E-mail */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Endereço de E-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="Ex.: colaborador@espacieservices.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Departamento e Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Departamento
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ex.: Operações"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-800 mb-1">
                Categoria / Função
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ex.: Mecânico de 1ª"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block font-semibold text-slate-800 mb-1">
              Observações / Notas Internas
            </label>
            <textarea
              rows={2}
              placeholder="Notas sobre o colaborador ou preferência de envio..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white text-slate-900"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{contact ? 'Gravar Alterações' : 'Gravar Contacto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
