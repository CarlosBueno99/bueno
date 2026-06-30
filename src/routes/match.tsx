import { createFileRoute } from '@tanstack/react-router'
import { API_BASE } from "../lib/api";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Badge } from "../../components/ui/badge";
import { Progress } from "../../components/ui/progress";

// Types for our match data
interface Player {
  name: string;
  steamId: string;
  team: string;
  kills: number;
  deaths: number;
  assists: number;
  hsp: number;
  adr: number;
  kast: number;
  rating: number;
  totalMoneySpent?: number;
  avgEquipmentValue?: number;
  roundsPlayed?: number;
}

interface Round {
  number: number;
  winner: string;
  winType: string;
  duration: number;
  score: {
    team1: number;
    team2: number;
  };
}

interface EconomyEntry {
  roundNumber: number;
  name: string;
  steamId: string;
  startMoney: number;
  moneySpent: number;
  equipmentValue: number;
  type: string;
  playerSide: number;
}

interface ChatMessage {
  frame: number;
  tick: number;
  roundNumber: number;
  message: string;
  senderSteamId: string;
  senderName: string;
  senderSide: number;
  isSenderAlive: boolean;
}

interface MatchStats {
  map: string;
  date: string;
  duration: string;
  teams: {
    team1: {
      name: string;
      score: number;
      players: Player[];
    };
    team2: {
      name: string;
      score: number;
      players: Player[];
    };
  };
  rounds: Round[];
  economy?: EconomyEntry[];
  chatMessages?: ChatMessage[];
}

function MatchPage() {
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatchData() {
      try {
        const response = await fetch(`${API_BASE}/api/cs`);
        if (!response.ok) {
          throw new Error('Failed to fetch match data');
        }
        const data = await response.json();
        setMatchStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchMatchData();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading match data...</div>
      </div>
    );
  }

  if (error || !matchStats) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center text-red-500">
          {error || 'Failed to load match data'}
        </div>
      </div>
    );
  }

  // Group economy data by round
  const economyByRound: Record<number, EconomyEntry[]> = {};
  (matchStats.economy || []).forEach((entry) => {
    if (!economyByRound[entry.roundNumber]) economyByRound[entry.roundNumber] = [];
    economyByRound[entry.roundNumber].push(entry);
  });

  // Group chat messages by round
  const chatByRound: Record<number, ChatMessage[]> = {};
  (matchStats.chatMessages || []).forEach((msg) => {
    if (!chatByRound[msg.roundNumber]) chatByRound[msg.roundNumber] = [];
    chatByRound[msg.roundNumber].push(msg);
  });

  return (
    <div className="container mx-auto py-8">
      {/* Match Overview */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">{matchStats.teams.team1.name} vs {matchStats.teams.team2.name}</CardTitle>
              <CardDescription>
                {matchStats.map} • {new Date(matchStats.date).toLocaleDateString()} • Duration: {matchStats.duration}
              </CardDescription>
            </div>
            <div className="text-4xl font-bold">
              <span className={matchStats.teams.team1.score > matchStats.teams.team2.score ? "text-green-500" : ""}>
                {matchStats.teams.team1.score}
              </span>
              <span className="mx-2">:</span>
              <span className={matchStats.teams.team2.score > matchStats.teams.team1.score ? "text-green-500" : ""}>
                {matchStats.teams.team2.score}
              </span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Detailed Stats Tabs */}
      <Tabs defaultValue="scoreboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="scoreboard">Scoreboard</TabsTrigger>
          <TabsTrigger value="rounds">Rounds</TabsTrigger>
          <TabsTrigger value="economy">Economy</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>

        {/* Scoreboard Tab */}
        <TabsContent value="scoreboard">
          <Card>
            <CardHeader>
              <CardTitle>Match Scoreboard</CardTitle>
              <CardDescription>Detailed player statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Team 1 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">{matchStats.teams.team1.name}</h3>
                  <div className="grid grid-cols-13 gap-4 text-sm font-medium mb-2">
                    <div className="col-span-2">Player</div>
                    <div>K</div>
                    <div>D</div>
                    <div>A</div>
                    <div>HS%</div>
                    <div>ADR</div>
                    <div>KAST</div>
                    <div>Rating</div>
                    <div>Total $</div>
                    <div>Avg Equip $</div>
                    <div>Rounds</div>
                  </div>
                  {matchStats.teams.team1.players.map((player) => (
                    <div key={player.steamId} className="grid grid-cols-13 gap-4 text-sm py-2 border-t">
                      <div className="col-span-2">{player.name}</div>
                      <div>{player.kills}</div>
                      <div>{player.deaths}</div>
                      <div>{player.assists}</div>
                      <div>{player.hsp.toFixed(1)}%</div>
                      <div>{player.adr.toFixed(1)}</div>
                      <div>{player.kast.toFixed(1)}%</div>
                      <div>{player.rating.toFixed(2)}</div>
                      <div>{player.totalMoneySpent?.toLocaleString?.() ?? 0}</div>
                      <div>{player.avgEquipmentValue?.toFixed?.(0) ?? 0}</div>
                      <div>{player.roundsPlayed ?? 0}</div>
                    </div>
                  ))}
                </div>

                {/* Team 2 */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">{matchStats.teams.team2.name}</h3>
                  <div className="grid grid-cols-13 gap-4 text-sm font-medium mb-2">
                    <div className="col-span-2">Player</div>
                    <div>K</div>
                    <div>D</div>
                    <div>A</div>
                    <div>HS%</div>
                    <div>ADR</div>
                    <div>KAST</div>
                    <div>Rating</div>
                    <div>Total $</div>
                    <div>Avg Equip $</div>
                    <div>Rounds</div>
                  </div>
                  {matchStats.teams.team2.players.map((player) => (
                    <div key={player.steamId} className="grid grid-cols-13 gap-4 text-sm py-2 border-t">
                      <div className="col-span-2">{player.name}</div>
                      <div>{player.kills}</div>
                      <div>{player.deaths}</div>
                      <div>{player.assists}</div>
                      <div>{player.hsp.toFixed(1)}%</div>
                      <div>{player.adr.toFixed(1)}</div>
                      <div>{player.kast.toFixed(1)}%</div>
                      <div>{player.rating.toFixed(2)}</div>
                      <div>{player.totalMoneySpent?.toLocaleString?.() ?? 0}</div>
                      <div>{player.avgEquipmentValue?.toFixed?.(0) ?? 0}</div>
                      <div>{player.roundsPlayed ?? 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rounds Tab */}
        <TabsContent value="rounds">
          <Card>
            <CardHeader>
              <CardTitle>Round History</CardTitle>
              <CardDescription>Round-by-round breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {matchStats.rounds.map((round) => (
                  <div key={round.number} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full font-bold">
                      {round.number}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{round.winner}</span>
                          <Badge variant="secondary">{round.winType}</Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          {Math.floor(round.duration / 60)}:{(round.duration % 60).toString().padStart(2, '0')}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium">{round.score.team1} - {round.score.team2}</span>
                        <Progress value={(round.score.team1 / (round.score.team1 + round.score.team2)) * 100} className="h-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Economy Tab */}
        <TabsContent value="economy">
          <Card>
            <CardHeader>
              <CardTitle>Economy Analysis</CardTitle>
              <CardDescription>Team economy and equipment value per round</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(economyByRound).length === 0 ? (
                <div className="text-center text-gray-500">No economy data available</div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(economyByRound).map(([roundNumber, entries]) => (
                    <div key={roundNumber} className="mb-6">
                      <h4 className="font-semibold mb-2">Round {roundNumber}</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs border">
                          <thead>
                            <tr className="bg-muted">
                              <th className="px-2 py-1 text-left">Player</th>
                              <th className="px-2 py-1">Side</th>
                              <th className="px-2 py-1">Buy Type</th>
                              <th className="px-2 py-1">Start $</th>
                              <th className="px-2 py-1">Spent $</th>
                              <th className="px-2 py-1">Equip $</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map((entry) => (
                              <tr key={entry.steamId + '-' + entry.name}>
                                <td className="px-2 py-1">{entry.name}</td>
                                <td className="px-2 py-1">{entry.playerSide === 2 ? 'T' : entry.playerSide === 3 ? 'CT' : '-'}</td>
                                <td className="px-2 py-1">{entry.type}</td>
                                <td className="px-2 py-1">{entry.startMoney}</td>
                                <td className="px-2 py-1">{entry.moneySpent}</td>
                                <td className="px-2 py-1">{entry.equipmentValue}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Heatmap Tab */}
        <TabsContent value="heatmap">
          <Card>
            <CardHeader>
              <CardTitle>Position Heatmap</CardTitle>
              <CardDescription>Player positions and engagement areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center text-gray-500">
                Heatmap visualization will be implemented with actual demo data
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chat Tab */}
        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>In-Game Chat Log</CardTitle>
              <CardDescription>All chat messages by round</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(chatByRound).length === 0 ? (
                <div className="text-center text-gray-500">No chat messages available</div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(chatByRound).map(([roundNumber, messages]) => (
                    <div key={roundNumber} className="mb-6">
                      <h4 className="font-semibold mb-2">Round {roundNumber}</h4>
                      <div className="space-y-2">
                        {messages.map((msg, idx) => (
                          <div key={msg.frame + '-' + idx} className="flex items-center gap-2 text-sm">
                            <span className={msg.isSenderAlive ? "text-green-600" : "text-gray-400"}>
                              {msg.senderName}
                              {msg.isSenderAlive ? '' : ' (dead)'}
                            </span>
                            <span className="text-muted-foreground">:</span>
                            <span className="break-all">{msg.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const Route = createFileRoute('/match')({
  component: MatchPage,
})
