import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useWeb3React } from '@web3-react/core';
import { injected } from '../utils/connectors';
import { Box, Flex, Button, Link, Text, useColorMode, IconButton, HStack } from '@chakra-ui/react';
import { FiSun, FiMoon } from 'react-icons/fi';

const Navbar: React.FC = () => {
  const { account, activate, deactivate, active } = useWeb3React();
  const { colorMode, toggleColorMode } = useColorMode();

  const handleConnect = async () => {
    try {
      await activate(injected);
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  const handleDisconnect = () => {
    try {
      deactivate();
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  return (
    <Box px={4} shadow="md">
      <Flex h={16} alignItems="center" justifyContent="space-between">
        <HStack spacing={8}>
          <Text fontSize="xl" fontWeight="bold">
            Chain 138 Governance
          </Text>
          <HStack spacing={4}>
            <Link as={RouterLink} to="/">
              Home
            </Link>
            <Link as={RouterLink} to="/proposals">
              Proposals
            </Link>
            <Link as={RouterLink} to="/create">
              Create
            </Link>
            <Link as={RouterLink} to="/analytics">
              Analytics
            </Link>
          </HStack>
        </HStack>

        <HStack spacing={4}>
          <IconButton
            aria-label="Toggle color mode"
            icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
            onClick={toggleColorMode}
          />

          {active ? (
            <HStack>
              <Text>
                {account?.substring(0, 6)}...{account?.substring(38)}
              </Text>
              <Button onClick={handleDisconnect} colorScheme="red" size="sm">
                Disconnect
              </Button>
            </HStack>
          ) : (
            <Button onClick={handleConnect} colorScheme="blue">
              Connect Wallet
            </Button>
          )}
        </HStack>
      </Flex>
    </Box>
  );
};

export default Navbar;
