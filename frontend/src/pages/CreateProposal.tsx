import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWeb3React } from '@web3-react/core';
import {
  Box,
  Container,
  Heading,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Button,
  VStack,
  useToast,
  Text,
  Select,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Alert,
  AlertIcon,
  useColorModeValue
} from '@chakra-ui/react';

const CreateProposal: React.FC = () => {
  const { active } = useWeb3React();
  const navigate = useNavigate();
  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'general',
    votingPeriod: 7,
    quorum: 10
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!active) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to create a proposal',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
      return;
    }

    try {
      // Implement proposal creation logic here
      console.log('Creating proposal:', formData);

      toast({
        title: 'Proposal Created',
        description: 'Your proposal has been submitted successfully',
        status: 'success',
        duration: 5000,
        isClosable: true
      });

      navigate('/proposals');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create proposal. Please try again.',
        status: 'error',
        duration: 5000,
        isClosable: true
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <Container maxW="container.md" py={10}>
      <Box bg={bgColor} p={8} rounded="lg" shadow="base">
        <Heading mb={6}>Create Proposal</Heading>

        {!active && (
          <Alert status="warning" mb={6}>
            <AlertIcon />
            Please connect your wallet to create a proposal
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <VStack spacing={6} align="stretch">
            <FormControl isRequired>
              <FormLabel>Proposal Title</FormLabel>
              <Input
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Enter proposal title"
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Proposal Description</FormLabel>
              <Textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Describe your proposal in detail"
                minH="200px"
              />
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Proposal Type</FormLabel>
              <Select
                name="type"
                value={formData.type}
                onChange={handleChange}
              >
                <option value="general">General</option>
                <option value="parameter">Parameter Change</option>
                <option value="upgrade">Protocol Upgrade</option>
                <option value="treasury">Treasury</option>
              </Select>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Voting Period (days)</FormLabel>
              <NumberInput
                min={1}
                max={30}
                value={formData.votingPeriod}
                onChange={(value) =>
                  setFormData(prev => ({ ...prev, votingPeriod: Number(value) }))
                }
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
            </FormControl>

            <FormControl isRequired>
              <FormLabel>Quorum Percentage</FormLabel>
              <NumberInput
                min={1}
                max={100}
                value={formData.quorum}
                onChange={(value) =>
                  setFormData(prev => ({ ...prev, quorum: Number(value) }))
                }
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Text fontSize="sm" color="gray.500" mt={1}>
                Minimum percentage of total voting power required
              </Text>
            </FormControl>

            <Button
              type="submit"
              colorScheme="blue"
              size="lg"
              isDisabled={!active}
            >
              Create Proposal
            </Button>
          </VStack>
        </form>
      </Box>
    </Container>
  );
};

export default CreateProposal; 