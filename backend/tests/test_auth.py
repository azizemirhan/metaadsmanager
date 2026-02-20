# -*- coding: utf-8 -*-
"""
Auth modülü unit testleri:
- hash_password / verify_password
- create_access_token / decode_token
- generate_user_id
"""
import pytest
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_token,
    generate_user_id,
)


class TestPasswordHashing:
    def test_hash_returns_non_empty_string(self):
        hashed = hash_password("mypassword")
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_hash_is_not_plaintext(self):
        plain = "mypassword"
        hashed = hash_password(plain)
        assert hashed != plain

    def test_verify_correct_password_returns_true(self):
        plain = "correct_password"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True

    def test_verify_wrong_password_returns_false(self):
        hashed = hash_password("correct_password")
        assert verify_password("wrong_password", hashed) is False

    def test_two_hashes_of_same_password_are_different(self):
        """bcrypt her seferinde farklı salt kullanır."""
        plain = "samepassword"
        hash1 = hash_password(plain)
        hash2 = hash_password(plain)
        assert hash1 != hash2
        # Ama ikisi de doğru verify etmeli
        assert verify_password(plain, hash1) is True
        assert verify_password(plain, hash2) is True

    def test_empty_password_can_be_hashed(self):
        hashed = hash_password("")
        assert verify_password("", hashed) is True

    def test_unicode_password(self):
        plain = "şifreÖzel123!"
        hashed = hash_password(plain)
        assert verify_password(plain, hashed) is True


class TestJWT:
    def test_create_token_returns_string(self):
        token = create_access_token("uid1", "user@test.com", "admin", "testuser")
        assert isinstance(token, str)
        assert len(token) > 0

    def test_decode_valid_token(self):
        token = create_access_token("uid1", "user@test.com", "manager", "testuser")
        payload = decode_token(token)
        assert payload is not None
        assert payload["sub"] == "uid1"
        assert payload["email"] == "user@test.com"
        assert payload["role"] == "manager"
        assert payload["username"] == "testuser"

    def test_decode_invalid_token_returns_none(self):
        result = decode_token("this.is.not.a.valid.token")
        assert result is None

    def test_decode_empty_token_returns_none(self):
        result = decode_token("")
        assert result is None

    def test_decode_tampered_token_returns_none(self):
        token = create_access_token("uid1", "user@test.com", "admin", "testuser")
        tampered = token[:-5] + "XXXXX"
        result = decode_token(tampered)
        assert result is None

    def test_token_contains_exp_and_iat(self):
        token = create_access_token("uid1", "user@test.com", "viewer", "testuser")
        payload = decode_token(token)
        assert "exp" in payload
        assert "iat" in payload

    def test_different_users_get_different_tokens(self):
        token1 = create_access_token("uid1", "user1@test.com", "admin", "user1")
        token2 = create_access_token("uid2", "user2@test.com", "viewer", "user2")
        assert token1 != token2


class TestGenerateUserId:
    def test_returns_string(self):
        uid = generate_user_id()
        assert isinstance(uid, str)

    def test_returns_uuid_format(self):
        import uuid
        uid = generate_user_id()
        # UUID formatını doğrula (hata fırlatmazsa geçerli)
        parsed = uuid.UUID(uid)
        assert str(parsed) == uid

    def test_each_call_returns_unique_id(self):
        ids = {generate_user_id() for _ in range(100)}
        assert len(ids) == 100
