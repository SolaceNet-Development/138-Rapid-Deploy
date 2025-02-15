import React from 'react';
import { useWeb3React } from '@web3-react/core';
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Button,
  useColorModeValue,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  SimpleGrid,
  Icon
} from '@chakra-ui/react';
import { FiCheck, FiX } from 'react-icons/fi';

const mockVotingHistory = [
  {
    id: 1,
    proposal: 'Implement Cross-Chain Bridge',
    vote: 'For',
    date: '2024-03-15',
    status: 'Active'
  },
  {
    id: 2,
    proposal: 'Upgrade Governance Parameters',
    vote: 'Against',
    date: '2024-03-10',
    status: 'Passed'
  },
  {
    id: 3,
    proposal: 'Add New Token Pairs',
    vote: 'For',
    date: '2024-03-05',
    status: 'Active'
  }
];

const Profile: React.FC = () => {
  const { account, active } = useWeb3React();
  const bgColor = useColorModeValue('white', 'gray.800');

  if (!active) {
    return (
      <Container maxW="container.xl" py={10}>
        <Box p={8} bg={bgColor} rounded="lg" shadow="base" textAlign="center">
          <Heading size="lg" mb={4}>
            Connect Wallet
          </Heading>
          <Text>Please connect your wallet to view your profile</Text>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={10}>
      <VStack spacing={8} align="stretch">
        <Box p={8} bg={bgColor} rounded="lg" shadow="base">
          <VStack align="start" spacing={4}>
            <Heading size="lg">Profile</Heading>
            <HStack>
              <Text fontWeight="bold">Address:</Text>
              <Text>{account}</Text>
            </HStack>
            <Badge colorScheme="green" px={2} py={1} rounded="md">
              Active Voter
            </Badge>
          </VStack>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
          <Stat p={4} bg={bgColor} rounded="lg" shadow="base">
            <StatLabel>Voting Power</StatLabel>
            <StatNumber>1,234 C138</StatNumber>
            <StatHelpText>12.3% of total supply</StatHelpText>
          </Stat>

          <Stat p={4} bg={bgColor} rounded="lg" shadow="base">
            <StatLabel>Proposals Voted</StatLabel>
            <StatNumber>15</StatNumber>
            <StatHelpText>Last 30 days</StatHelpText>
          </Stat>

          <Stat p={4} bg={bgColor} rounded="lg" shadow="base">
            <StatLabel>Participation Rate</StatLabel>
            <StatNumber>85%</StatNumber>
            <StatHelpText>Above average</StatHelpText>
          </Stat>
        </SimpleGrid>

        <Box p={8} bg={bgColor} rounded="lg" shadow="base">
          <Heading size="md" mb={6}>
            Voting History
          </Heading>
          <Table variant="simple">
            <Thead>
              <Tr>
                <Th>Proposal</Th>
                <Th>Vote</Th>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {mockVotingHistory.map((item) => (
                <Tr key={item.id}>
                  <Td>{item.proposal}</Td>
                  <Td>
                    <HStack>
                      <Icon
                        as={item.vote === 'For' ? FiCheck : FiX}
                        color={item.vote === 'For' ? 'green.500' : 'red.500'}
                      />
                      <Text>{item.vote}</Text>
                    </HStack>
                  </Td>
                  <Td>{item.date}</Td>
                  <Td>
                    <Badge colorScheme={item.status === 'Active' ? 'green' : 'blue'}>
                      {item.status}
                    </Badge>
                  </Td>
                  <Td>
                    <Button size="sm" variant="outline" isDisabled={item.status !== 'Active'}>
                      Change Vote
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>

        <Box p={8} bg={bgColor} rounded="lg" shadow="base">
          <Heading size="md" mb={6}>
            Delegation
          </Heading>
          <VStack align="start" spacing={4}>
            <Text>
              You can delegate your voting power to another address to vote on your behalf.
            </Text>
            <HStack>
              <Button colorScheme="blue">Delegate Voting Power</Button>
              <Button variant="outline">View Delegation History</Button>
            </HStack>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
};

export default Profile;
