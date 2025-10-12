import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useDataStore } from '@/store/data';
import { useAuthStore } from '@/store/auth';
import { Trophy, Medal, Award, TrendingUp, Target, Star } from 'lucide-react';

export default function AgentLeaderboard() {
  const { user } = useAuthStore();
  const { users, progresses, certificates } = useDataStore();

  // Calculate leaderboard rankings
  const agents = users.filter(u => u.role === 'agent');
  
  const leaderboardData = agents.map(agent => {
    const agentProgress = progresses.filter(p => p.userId === agent.id);
    const agentCerts = certificates.filter(c => c.userId === agent.id);
    
    // Calculate metrics
    const totalCourses = agentProgress.length;
    const completedCourses = agentProgress.filter(p => p.percent === 100).length;
    const avgProgress = totalCourses > 0
      ? Math.round(agentProgress.reduce((sum, p) => sum + p.percent, 0) / totalCourses)
      : 0;
    const avgCertScore = agentCerts.length > 0
      ? Math.round(agentCerts.reduce((sum, c) => sum + c.scorePercent, 0) / agentCerts.length)
      : 0;
    
    // Calculate points system
    const points = (
      (completedCourses * 100) +           // 100 points per completed course
      (agentCerts.length * 50) +           // 50 points per certificate
      (avgCertScore * agentCerts.length)   // Bonus: avg score * number of certs
    );
    
    return {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      profilePicture: (agent as any)?.profilePicture,
      totalCourses,
      completedCourses,
      certificates: agentCerts.length,
      avgProgress,
      avgCertScore,
      points,
      isCurrentUser: agent.id === user?.id
    };
  }).sort((a, b) => b.points - a.points); // Sort by points descending

  // Find current user rank
  const currentUserRank = leaderboardData.findIndex(a => a.id === user?.id) + 1;
  const currentUserData = leaderboardData.find(a => a.id === user?.id);

  // Get badge for rank
  const getBadge = (rank: number) => {
    if (rank === 1) return { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: '1st Place' };
    if (rank === 2) return { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-400/10', label: '2nd Place' };
    if (rank === 3) return { icon: Medal, color: 'text-orange-600', bg: 'bg-orange-600/10', label: '3rd Place' };
    if (rank <= 10) return { icon: Star, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Top 10' };
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border border-primary/10">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Leaderboard
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            See how you rank among other agents and compete for the top spot!
          </p>
        </div>
      </div>

      {/* Current User Stats */}
      {currentUserData && (
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-16 h-16 border-2 border-primary">
                    <AvatarImage src={currentUserData.profilePicture || ''} alt="Your Profile" />
                    <AvatarFallback className="text-lg font-medium bg-primary/10">
                      {currentUserData.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {currentUserRank <= 3 && (() => {
                    const badge = getBadge(currentUserRank);
                    const BadgeIcon = badge?.icon;
                    return badge && BadgeIcon ? (
                      <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full ${badge.bg} flex items-center justify-center border-2 border-background`}>
                        <BadgeIcon className={`w-3 h-3 ${badge.color}`} />
                      </div>
                    ) : null;
                  })()}
                </div>
                <div>
                  <h3 className="text-xl font-bold">Your Ranking</h3>
                  <p className="text-sm text-muted-foreground">
                    Rank #{currentUserRank} of {leaderboardData.length} agents
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{currentUserData.points}</p>
                  <p className="text-xs text-muted-foreground">Points</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{currentUserData.certificates}</p>
                  <p className="text-xs text-muted-foreground">Certificates</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{currentUserData.avgProgress}%</p>
                  <p className="text-xs text-muted-foreground">Avg Progress</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Top Performers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {leaderboardData.map((agent, index) => {
              const rank = index + 1;
              const badge = getBadge(rank);
              
              return (
                <div
                  key={agent.id}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    agent.isCurrentUser
                      ? 'bg-primary/5 border border-primary/20'
                      : 'bg-muted/30 hover-elevate'
                  }`}
                  data-testid={`leaderboard-row-${rank}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Rank */}
                    <div className="w-12 text-center">
                      {rank <= 3 ? (
                        <div className={`w-10 h-10 rounded-full ${badge?.bg} flex items-center justify-center`}>
                          {badge && (() => {
                            const BadgeIcon = badge.icon;
                            return <BadgeIcon className={`w-5 h-5 ${badge.color}`} />;
                          })()}
                        </div>
                      ) : (
                        <span className="text-2xl font-bold text-muted-foreground">#{rank}</span>
                      )}
                    </div>

                    {/* Profile */}
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={agent.profilePicture || ''} alt={agent.name} />
                      <AvatarFallback className="text-sm font-medium">
                        {agent.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold" data-testid={`text-agent-name-${rank}`}>
                          {agent.name}
                        </h3>
                        {agent.isCurrentUser && (
                          <Badge variant="default" className="text-xs">You</Badge>
                        )}
                        {badge && rank <= 10 && (
                          <Badge variant="secondary" className="text-xs">{badge.label}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {agent.completedCourses}/{agent.totalCourses} courses • {agent.certificates} certificates
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex gap-8">
                      <div className="text-center">
                        <p className="text-lg font-bold" data-testid={`text-points-${rank}`}>{agent.points}</p>
                        <p className="text-xs text-muted-foreground">Points</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{agent.avgProgress}%</p>
                        <p className="text-xs text-muted-foreground">Progress</p>
                      </div>
                      {agent.avgCertScore > 0 && (
                        <div className="text-center">
                          <p className="text-lg font-bold">{agent.avgCertScore}%</p>
                          <p className="text-xs text-muted-foreground">Avg Score</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {leaderboardData.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No agents on the leaderboard yet</p>
                <p className="text-sm text-muted-foreground">Complete courses to earn points and climb the rankings!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Points System Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            How Points Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Award className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-semibold">Course Completion</p>
                <p className="text-sm text-muted-foreground">100 points per completed course</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <Medal className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="font-semibold">Certificate Earned</p>
                <p className="text-sm text-muted-foreground">50 points per certificate</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold">Score Bonus</p>
                <p className="text-sm text-muted-foreground">Avg score × certificate count</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
