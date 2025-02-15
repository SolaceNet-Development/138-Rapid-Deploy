import React from 'react';
import {
  Box,
  Container,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  useColorModeValue
} from '@chakra-ui/react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const votingHistory = [
  { date: '2024-01', proposals: 8, participation: 65 },
  { date: '2024-02', proposals: 12, participation: 72 },
  { date: '2024-03', proposals: 10, participation: 68 },
  { date: '2024-04', proposals: 15, participation: 75 }
];

const proposalTypes = [
  { name: 'General', value: 35 },
  { name: 'Parameter', value: 25 },
  { name: 'Upgrade', value: 20 },
  { name: 'Treasury', value: 20 }
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

const Analytics: React.FC = () => {
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.800', 'white');

  return (
    <Container maxW="container.xl" py={10}>
      <Heading mb={8}>Governance Analytics</Heading>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={10}>
        <Stat p={4} bg={bgColor} rounded="lg" shadow="base">
          <StatLabel>Total Proposals</StatLabel>
          <StatNumber>45</StatNumber>
          <StatHelpText>
            <StatArrow type="increase" />
            23.36%
          </StatHelpText>
        </Stat>

        <Stat p={4} bg={bgColor} rounded="lg" shadow="base">
          <StatLabel>Active Voters</StatLabel>
          <StatNumber>1,234</StatNumber>
          <StatHelpText>
            <StatArrow type="increase" />
            12.5%
          </StatHelpText>
        </Stat>

        <Stat p={4} bg={bgColor} rounded="lg" shadow="base">
          <StatLabel>Avg. Participation Rate</StatLabel>
          <StatNumber>70.5%</StatNumber>
          <StatHelpText>
            <StatArrow type="increase" />
            8.2%
          </StatHelpText>
        </Stat>

        <Stat p={4} bg={bgColor} rounded="lg" shadow="base">
          <StatLabel>Proposal Success Rate</StatLabel>
          <StatNumber>82.3%</StatNumber>
          <StatHelpText>
            <StatArrow type="decrease" />
            3.1%
          </StatHelpText>
        </Stat>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8}>
        <Box bg={bgColor} p={6} rounded="lg" shadow="base">
          <Heading size="md" mb={4}>
            Voting History
          </Heading>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={votingHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="proposals"
                stroke="#8884d8"
                name="Proposals"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="participation"
                stroke="#82ca9d"
                name="Participation %"
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>

        <Box bg={bgColor} p={6} rounded="lg" shadow="base">
          <Heading size="md" mb={4}>
            Proposal Types Distribution
          </Heading>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={proposalTypes}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {proposalTypes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Box>

        <Box bg={bgColor} p={6} rounded="lg" shadow="base">
          <Heading size="md" mb={4}>
            Monthly Participation
          </Heading>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={votingHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="participation" fill="#8884d8" name="Participation %" />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Box bg={bgColor} p={6} rounded="lg" shadow="base">
          <Heading size="md" mb={4}>
            Proposal Activity
          </Heading>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={votingHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="proposals" fill="#82ca9d" name="Number of Proposals" />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </SimpleGrid>
    </Container>
  );
};

export default Analytics;
