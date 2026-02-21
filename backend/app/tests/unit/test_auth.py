# -*- coding: utf-8 -*-
"""Unit tests for authentication module."""

import pytest
from datetime import datetime, timedelta, timezone
from jose import jwt

from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    JWT_SECRET,
    JWT_ALGORITHM,
    JWT_EXPIRE_MINUTES,
    generate_user_id,
)


class TestPasswordHashing:
    """Tests for password hashing functionality."""
    
    def test_hash_password_generates_different_hashes(self):
        """Same password should generate different hashes due to salt."""
        password = "testpassword123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        
        assert hash1 != hash2
        assert isinstance(hash1, str)
        assert len(hash1) > 0
    
    def test_hash_password_not_equal_to_plain(self):
        """Hashed password should not equal plain password."""
        password = "testpassword123"
        hashed = hash_password(password)
        
        assert hashed != password
        assert hashed.startswith("$2")  # bcrypt prefix


class TestPasswordVerification:
    """Tests for password verification."""
    
    def test_verify_password_success(self):
        """Correct password should verify successfully."""
        password = "testpassword123"
        hashed = hash_password(password)
        
        assert verify_password(password, hashed) is True
    
    def test_verify_password_failure_wrong_password(self):
        """Wrong password should fail verification."""
        password = "testpassword123"
        wrong_password = "wrongpassword"
        hashed = hash_password(password)
        
        assert verify_password(wrong_password, hashed) is False
    
    def test_verify_password_failure_empty_password(self):
        """Empty password should fail verification."""
        password = "testpassword123"
        hashed = hash_password(password)
        
        assert verify_password("", hashed) is False
    
    def test_verify_password_failure_invalid_hash(self):
        """Invalid hash should not crash, should return False."""
        assert verify_password("password", "invalid_hash") is False


class TestJWTTokenCreation:
    """Tests for JWT token creation."""
    
    def test_create_access_token_returns_string(self):
        """Token creation should return a string."""
        token = create_access_token(
            sub="user123",
            email="test@example.com",
            role="admin",
            username="testuser"
        )
        
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_create_access_token_contains_correct_data(self):
        """Token should contain the correct payload data."""
        token = create_access_token(
            sub="user123",
            email="test@example.com",
            role="admin",
            username="testuser"
        )
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        assert decoded["sub"] == "user123"
        assert decoded["email"] == "test@example.com"
        assert decoded["role"] == "admin"
        assert decoded["username"] == "testuser"
    
    def test_create_access_token_has_expiration(self):
        """Token should have expiration claim."""
        token = create_access_token(
            sub="user123",
            email="test@example.com",
            role="admin",
            username="testuser"
        )
        decoded = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        assert "exp" in decoded
        assert "iat" in decoded  # Issued at
        
        exp_time = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
        now = datetime.now(timezone.utc)
        
        # Expiration should be in the future
        assert exp_time > now
        # Should be approximately JWT_EXPIRE_MINUTES from now
        expected_exp = now + timedelta(minutes=JWT_EXPIRE_MINUTES)
        assert abs((exp_time - expected_exp).total_seconds()) < 5


class TestJWTTokenDecoding:
    """Tests for JWT token decoding."""
    
    def test_decode_token_success(self):
        """Valid token should decode correctly."""
        token = create_access_token(
            sub="user123",
            email="test@example.com",
            role="admin",
            username="testuser"
        )
        decoded = decode_token(token)
        
        assert decoded is not None
        assert decoded["sub"] == "user123"
        assert decoded["email"] == "test@example.com"
        assert decoded["role"] == "admin"
        assert decoded["username"] == "testuser"
    
    def test_decode_token_invalid_token(self):
        """Invalid token should return None."""
        result = decode_token("invalid_token")
        assert result is None
    
    def test_decode_token_expired(self):
        """Expired token should return None."""
        # Create expired token manually
        expired_time = datetime.now(timezone.utc) - timedelta(hours=1)
        payload = {
            "sub": "user123",
            "email": "test@example.com",
            "role": "admin",
            "username": "testuser",
            "exp": expired_time,
            "iat": expired_time - timedelta(minutes=10),
        }
        expired_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        result = decode_token(expired_token)
        assert result is None
    
    def test_decode_token_wrong_secret(self):
        """Token with wrong secret should return None."""
        payload = {
            "sub": "user123",
            "email": "test@example.com",
            "role": "admin",
            "username": "testuser",
            "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            "iat": datetime.now(timezone.utc),
        }
        wrong_token = jwt.encode(payload, "wrong_secret", algorithm=JWT_ALGORITHM)
        
        result = decode_token(wrong_token)
        assert result is None
    
    def test_decode_token_malformed(self):
        """Malformed token should return None."""
        result = decode_token("not.a.valid.token")
        assert result is None
    
    def test_decode_token_empty(self):
        """Empty token should return None."""
        result = decode_token("")
        assert result is None


class TestTokenExpiryEdgeCases:
    """Edge case tests for token expiration."""
    
    def test_token_expires_exactly_at_expiry(self):
        """Token that is already expired should be invalid."""
        # Create token that expired 1 second ago (jwt uses >= for exp check)
        past = datetime.now(timezone.utc) - timedelta(seconds=1)
        payload = {
            "sub": "user123",
            "email": "test@example.com",
            "role": "admin",
            "username": "testuser",
            "exp": past,
            "iat": past - timedelta(minutes=1),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        result = decode_token(token)
        assert result is None
    
    def test_token_valid_just_before_expiry(self):
        """Token should be valid just before expiry."""
        # Create token that expires in 5 seconds
        future_time = datetime.now(timezone.utc) + timedelta(seconds=5)
        payload = {
            "sub": "user123",
            "email": "test@example.com",
            "role": "admin",
            "username": "testuser",
            "exp": future_time,
            "iat": datetime.now(timezone.utc),
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        
        result = decode_token(token)
        assert result is not None
        assert result["sub"] == "user123"


class TestUserIdGeneration:
    """Tests for user ID generation."""
    
    def test_generate_user_id_returns_string(self):
        """Should return a string UUID."""
        user_id = generate_user_id()
        assert isinstance(user_id, str)
        assert len(user_id) == 36  # UUID format
    
    def test_generate_user_id_unique(self):
        """Should generate unique IDs."""
        id1 = generate_user_id()
        id2 = generate_user_id()
        assert id1 != id2
    
    def test_generate_user_id_valid_uuid_format(self):
        """Should be valid UUID format."""
        user_id = generate_user_id()
        parts = user_id.split("-")
        assert len(parts) == 5
        assert len(parts[0]) == 8
        assert len(parts[1]) == 4
        assert len(parts[2]) == 4
        assert len(parts[3]) == 4
        assert len(parts[4]) == 12
