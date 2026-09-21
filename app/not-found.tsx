import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#202124] text-white p-4 text-center select-none">
      <div className="bg-[#303134] p-8 rounded-2xl border border-[#3c4043] max-w-md w-full shadow-2xl flex flex-col items-center">
        <h2 className="text-3xl font-bold text-[#8ab4f8] mb-2">404</h2>
        <p className="text-[#e8eaed] text-lg font-medium mb-1">Página não encontrada</p>
        <p className="text-[#9aa0a6] text-sm mb-6">
          A sala ou página que você procurou não existe ou foi encerrada.
        </p>
        <Link
          href="/"
          className="bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#041e49] font-medium px-5 py-2.5 rounded-full transition-colors inline-block text-sm"
        >
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}
