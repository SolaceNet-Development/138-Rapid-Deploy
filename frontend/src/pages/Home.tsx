import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  useColorModeValue
} from '@chakra-ui/react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const bgColor = useColorModeValue('gray.50', 'gray.900');
  const statBg = useColorModeValue('white', 'gray.800');

  const stats = [
    {
      label: 'Active Proposals',
      number: '12',
      change: '+2 this week'
    },
    {
      label: 'Total Votes Cast',
      number: '1,234',
      change: '+123 this week'
    },
    {
      label: 'Governance Token Price',
      number: '$12.34',
      change: '+5.6% this week'
    },
    {
      label: 'Total Value Locked',
      number: '$1.2M',
      change: '+100K this week'
    }
  ];

  return (
    <Box bg={bgColor} minH="calc(100vh - 64px)">
      <Container maxW="container.xl" py={10}>
        <Box textAlign="center" mb={10}>
          <Heading size="2xl" mb={4}>
            Welcome to Chain 138 Governance
          </Heading>
          <Text fontSize="xl" mb={6}>
            Participate in decentralized decision-making and shape the future of Chain 138
          </Text>
          <Button colorScheme="blue" size="lg" onClick={() => navigate('/proposals')}>
            View Active Proposals
          </Button>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6} mb={10}>
          {stats.map((stat, index) => (
            <Stat key={index} px={6} py={4} bg={statBg} shadow="base" rounded="lg">
              <StatLabel fontSize="md">{stat.label}</StatLabel>
              <StatNumber fontSize="3xl">{stat.number}</StatNumber>
              <StatHelpText>{stat.change}</StatHelpText>
            </Stat>
          ))}
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
          <Box bg={statBg} p={6} rounded="lg" shadow="base">
            <Heading size="md" mb={4}>
              Recent Activity
            </Heading>
            <Text>
              Track the latest governance activities and proposals in real-time. Stay informed about
              important decisions and community updates.
            </Text>
            <Button
              mt={4}
              colorScheme="blue"
              variant="outline"
              onClick={() => navigate('/analytics')}
            >
              View Analytics
            </Button>
          </Box>

          <Box bg={statBg} p={6} rounded="lg" shadow="base">
            <Heading size="md" mb={4}>
              Get Started
            </Heading>
            <Text>
              Create proposals, cast votes, and participate in the governance process. Your voice
              matters in shaping the future of Chain 138.
            </Text>
            <Button mt={4} colorScheme="blue" variant="outline" onClick={() => navigate('/create')}>
              Create Proposal
            </Button>
          </Box>
        </SimpleGrid>
      </Container>
    </Box>
  );
};

export default Home;
