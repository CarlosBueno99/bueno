import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Navbar } from "../../components/Navbar";
import { Card, CardContent } from "../../components/ui/card";

export default function LuckyNumbersPage() {
  const [luckyNumbers, setLuckyNumbers] = useState<number[]>([]);
  const [quinaNumbers, setQuinaNumbers] = useState<number[]>([]);
  const [copiedMega, setCopiedMega] = useState(false);
  const [copiedQuina, setCopiedQuina] = useState(false);

  const generateLuckyNumbers = () => {
    const numbers = new Set<number>();
    while (numbers.size < 6) {
      const randomNumber = Math.floor(Math.random() * 60) + 1;
      numbers.add(randomNumber);
    }
    setLuckyNumbers(Array.from(numbers).sort((a, b) => a - b));
  };

  const generateQuinaNumbers = () => {
    const numbers = new Set<number>();
    while (numbers.size < 5) {
      const randomNumber = Math.floor(Math.random() * 80) + 1;
      numbers.add(randomNumber);
    }
    setQuinaNumbers(Array.from(numbers).sort((a, b) => a - b));
  };

  const handleCopy = (numbers: number[], setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(numbers.join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  useEffect(() => {
    generateLuckyNumbers();
    generateQuinaNumbers();
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-3xl text-center font-bold mb-8">Números da sorte</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <span className="block text-xl font-semibold text-green-700 mb-2">Mega-sena</span>
            </div>
            <div className="flex justify-center flex-wrap gap-4 mb-8">
              {luckyNumbers.map((num, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-green-500 text-white rounded-full text-2xl md:text-3xl font-bold shadow-lg transform hover:scale-110 transition-transform"
                >
                  {num}
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4">
              <Button onClick={generateLuckyNumbers}>Gerar novos números</Button>
              <Button variant="outline" onClick={() => handleCopy(luckyNumbers, setCopiedMega)}>
                {copiedMega ? "Copiado!" : "Copiar"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quina Card */}
        <Card className="mt-8">
          <CardContent className="p-8 text-center">
            <div className="mb-6">
              <span className="block text-xl font-semibold text-blue-700 mb-2">Quina</span>
            </div>
            <div className="flex justify-center flex-wrap gap-4 mb-8">
              {quinaNumbers.map((num, index) => (
                <div
                  key={index}
                  className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-blue-500 text-white rounded-full text-2xl md:text-3xl font-bold shadow-lg transform hover:scale-110 transition-transform"
                >
                  {num}
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4">
              <Button onClick={generateQuinaNumbers}>Gerar novos números</Button>
              <Button variant="outline" onClick={() => handleCopy(quinaNumbers, setCopiedQuina)}>
                {copiedQuina ? "Copiado!" : "Copiar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}