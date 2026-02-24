export default function AdBanner() {
    return (
        <div className="w-full bg-slate-100 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center text-center mb-8 min-h-[250px]">
            <span className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-2">Publicidad</span>
            <div className="text-sm text-slate-500 max-w-[200px]">
                Espacio reservado para AdSense o afiliados.
            </div>
            {/* Aquí iría el tag <ins> real de Google AdSense */}
        </div>
    );
}
