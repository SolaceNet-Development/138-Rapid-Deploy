import React, { useState } from 'react';
import {
  Box,
  Container,
  Heading,
  Text,
  Button,
  VStack,
  HStack,
  Badge,
  Progress,
  useColorModeValue,
  Select,
  Flex,
  Spacer
} from '@chakra-ui/react';
import { useWeb3React } from '@web3-react/core';

interface Proposal {
  id: number;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'rejected' | 'pending';
  votesFor: number;
  votesAgainst: number;
  endTime: string;
}

const mockProposals: Proposal[] = [
  {
    id: 1,
    title: 'Implement Cross-Chain Bridge',
    description: 'Proposal to implement a cross-chain bridge for improved interoperability',
    status: 'active',
    votesFor: 1500000,
    votesAgainst: 500000,
    endTime: '2024-04-01'
  },
  {
    id: 2,
    title: 'Upgrade Governance Parameters',
    description: 'Update voting thresholds and timelock periods',
    status: 'passed',
    votesFor: 2000000,
    votesAgainst: 300000,
    endTime: '2024-03-15'
  },
  {
    id: 3,
    title: 'Add New Token Pairs',
    description: 'Add support for new token pairs in the DEX',
    status: 'active',
    votesFor: 800000,
    votesAgainst: 700000,
    endTime: '2024-04-05'
  }
];

const Proposals: React.FC = () => {
  const { active } = useWeb3React();
  const [filter, setFilter] = useState('all');
  const bgColor = useColorModeValue('white', 'gray.800');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'passed':
        return 'blue';
      case 'rejected':
        return 'red';
      default:
        return 'gray';
    }
  };

  const filteredProposals = mockProposals.filter((proposal) => {
    if (filter === 'all') return true;
    return proposal.status === filter;
  });

  const handleVote = async (proposalId: number, support: boolean) => {
    if (!active) {
      alert('Please connect your wallet to vote');
      return;
    }
    // Implement voting logic here
    console.log(`Voting ${support ? 'for' : 'against'} proposal ${proposalId}`);
  };

  return (
    <Container maxW="container.xl" py={10}>
      <Flex align="center" mb={8}>
        <Heading>Governance Proposals</Heading>
        <Spacer />
        <Select w="200px" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Proposals</option>
          <option value="active">Active</option>
          <option value="passed">Passed</option>
          <option value="rejected">Rejected</option>
          <option value="pending">Pending</option>
        </Select>
      </Flex>

      <VStack spacing={6} align="stretch">
        {filteredProposals.map((proposal) => (
          <Box key={proposal.id} p={6} bg={bgColor} shadow="md" rounded="lg">
            <Flex align="center" mb={4}>
              <Heading size="md">{proposal.title}</Heading>
              <Spacer />
              <Badge
                colorScheme={getStatusColor(proposal.status)}
                fontSize="sm"
                px={2}
                py={1}
                rounded="md"
              >
                {proposal.status.toUpperCase()}
              </Badge>
            </Flex>

            <Text mb={4}>{proposal.description}</Text>

            <Box mb={4}>
              <Text mb={2}>Voting Progress</Text>
              <Progress
                value={(proposal.votesFor / (proposal.votesFor + proposal.votesAgainst)) * 100}
                colorScheme="blue"
                rounded="md"
              />
              <Flex mt={2} fontSize="sm">
                <Text>For: {proposal.votesFor.toLocaleString()}</Text>
                <Spacer />
                <Text>Against: {proposal.votesAgainst.toLocaleString()}</Text>
              </Flex>
            </Box>

            <HStack spacing={4}>
              <Button
                colorScheme="green"
                onClick={() => handleVote(proposal.id, true)}
                isDisabled={proposal.status !== 'active' || !active}
              >
                Vote For
              </Button>
              <Button
                colorScheme="red"
                onClick={() => handleVote(proposal.id, false)}
                isDisabled={proposal.status !== 'active' || !active}
              >
                Vote Against
              </Button>
              <Spacer />
              <Text fontSize="sm">Ends: {new Date(proposal.endTime).toLocaleDateString()}</Text>
            </HStack>
          </Box>
        ))}
      </VStack>
    </Container>
  );
};

export default Proposals;
